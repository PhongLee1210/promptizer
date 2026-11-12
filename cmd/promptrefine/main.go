package main

import (
	"context"
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"io"
	"net"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"promptizer/internal/api"
	"promptizer/internal/config"
	"promptizer/internal/provider"
	"promptizer/internal/refine"
)

const version = "0.1.0"

func main() {
	if err := run(os.Args[1:], os.Stdin, os.Stdout, os.Stderr); err != nil {
		fmt.Fprintln(os.Stderr, "promptrefine:", err)
		os.Exit(1)
	}
}

func run(args []string, stdin io.Reader, stdout, stderr io.Writer) error {
	if len(args) == 0 {
		return errors.New("usage: promptrefine <refine|serve|pair|health|version>")
	}
	switch args[0] {
	case "refine":
		return runRefine(args[1:], stdin, stdout, stderr)
	case "version":
		_, err := fmt.Fprintln(stdout, version)
		return err
	case "serve":
		return runServe(args[1:], stderr)
	case "pair":
		return runPair(args[1:], stdout, stderr)
	case "health":
		return runHealth(args[1:], stdout, stderr)
	default:
		return fmt.Errorf("unknown command %q", args[0])
	}
}

func runPair(args []string, stdout, stderr io.Writer) error {
	flags := flag.NewFlagSet("pair", flag.ContinueOnError)
	flags.SetOutput(stderr)
	tokenFile := flags.String("token-file", "", "pairing token file")
	if err := flags.Parse(args); err != nil {
		return err
	}
	if flags.NArg() != 0 {
		return errors.New("pair does not accept positional arguments")
	}
	settings, err := config.Load()
	if err != nil {
		return err
	}
	path := firstNonempty(*tokenFile, settings.TokenFile)
	token, err := api.GenerateToken(path)
	if err != nil {
		return fmt.Errorf("generate pairing token: %w", err)
	}
	_, err = fmt.Fprintln(stdout, token)
	return err
}

func runServe(args []string, stderr io.Writer) error {
	flags := flag.NewFlagSet("serve", flag.ContinueOnError)
	flags.SetOutput(stderr)
	tokenFile := flags.String("token-file", "", "pairing token file")
	if err := flags.Parse(args); err != nil {
		return err
	}
	if flags.NArg() != 0 {
		return errors.New("serve does not accept positional arguments")
	}
	settings, err := config.Load()
	if err != nil {
		return err
	}
	if err := api.ValidateLoopbackAddress(settings.Address); err != nil {
		return err
	}
	token, err := api.LoadToken(firstNonempty(*tokenFile, settings.TokenFile))
	if err != nil {
		return fmt.Errorf("load pairing token (run promptrefine pair first): %w", err)
	}
	groq, err := provider.NewGroq(provider.GroqConfig{APIKey: settings.APIKey, ModelID: settings.Model, BaseURL: settings.GroqBaseURL, Client: &http.Client{Timeout: settings.Timeout}})
	if err != nil {
		return err
	}
	service := refine.NewService(groq)
	localAPI, err := api.NewServer(service, api.Config{Address: settings.Address, Token: token, AllowedOrigin: settings.ExtensionOrigin, ProviderName: "groq"})
	if err != nil {
		return err
	}
	listener, err := net.Listen("tcp4", settings.Address)
	if err != nil {
		return err
	}
	server := &http.Server{
		Handler:           localAPI.Handler(),
		ReadHeaderTimeout: 2 * time.Second,
		ReadTimeout:       8 * time.Second,
		WriteTimeout:      8 * time.Second,
		IdleTimeout:       30 * time.Second,
	}
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	go func() {
		<-ctx.Done()
		shutdownCtx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
		defer cancel()
		_ = server.Shutdown(shutdownCtx)
	}()
	fmt.Fprintf(stderr, "promptrefine serving on http://%s with model %s\n", settings.Address, settings.Model)
	err = server.Serve(listener)
	if errors.Is(err, http.ErrServerClosed) {
		return nil
	}
	return err
}

func runHealth(args []string, stdout, stderr io.Writer) error {
	flags := flag.NewFlagSet("health", flag.ContinueOnError)
	flags.SetOutput(stderr)
	if err := flags.Parse(args); err != nil {
		return err
	}
	settings, err := config.Load()
	if err != nil {
		return err
	}
	response, err := (&http.Client{Timeout: 2 * time.Second}).Get("http://" + settings.Address + "/healthz")
	if err != nil {
		return errors.New("local service is unavailable")
	}
	defer response.Body.Close()
	if response.StatusCode != http.StatusOK {
		return fmt.Errorf("local service returned HTTP %d", response.StatusCode)
	}
	_, err = io.Copy(stdout, io.LimitReader(response.Body, 4<<10))
	return err
}

func runRefine(args []string, stdin io.Reader, stdout, stderr io.Writer) error {
	flags := flag.NewFlagSet("refine", flag.ContinueOnError)
	flags.SetOutput(stderr)
	contextPath := flags.String("context-file", "", "explicitly selected context file")
	jsonOutput := flags.Bool("json", false, "write structured JSON")
	if err := flags.Parse(args); err != nil {
		return err
	}
	if flags.NArg() != 0 {
		return errors.New("prompt must be supplied through stdin, not command arguments")
	}
	prompt, err := readBounded(stdin, refine.MaxPromptBytes)
	if err != nil {
		return err
	}
	var taskContext string
	if *contextPath != "" {
		file, err := os.Open(*contextPath)
		if err != nil {
			return fmt.Errorf("open context file: %w", err)
		}
		defer file.Close()
		taskContext, err = readBounded(file, refine.MaxContextBytes)
		if err != nil {
			return fmt.Errorf("read context file: %w", err)
		}
	}
	normalized, err := refine.Validate(refine.Request{Prompt: prompt, TaskContext: taskContext, AllowRetry: true})
	if err != nil {
		return err
	}
	settings, err := config.Load()
	if err != nil {
		return err
	}
	client := &http.Client{Timeout: settings.Timeout}
	groq, err := provider.NewGroq(provider.GroqConfig{APIKey: settings.APIKey, ModelID: settings.Model, BaseURL: settings.GroqBaseURL, Client: client})
	if err != nil {
		return err
	}
	service := refine.NewService(groq)
	ctx, cancel := context.WithTimeout(context.Background(), settings.Timeout)
	defer cancel()
	result, err := service.Refine(ctx, normalized)
	if err != nil {
		return userError(err)
	}
	if *jsonOutput {
		encoder := json.NewEncoder(stdout)
		encoder.SetEscapeHTML(false)
		return encoder.Encode(result)
	}
	_, err = fmt.Fprintln(stdout, result.RefinedPrompt)
	return err
}

func readBounded(reader io.Reader, maximum int) (string, error) {
	data, err := io.ReadAll(io.LimitReader(reader, int64(maximum+1)))
	if err != nil {
		return "", err
	}
	if len(data) > maximum {
		return "", fmt.Errorf("input exceeds %d bytes", maximum)
	}
	return strings.TrimSpace(string(data)), nil
}

func userError(err error) error {
	var httpError *provider.HTTPError
	switch {
	case errors.Is(err, refine.ErrInvalidInput), errors.Is(err, refine.ErrTooLarge):
		return err
	case errors.Is(err, context.DeadlineExceeded):
		return errors.New("refinement timed out; no text was changed")
	case errors.As(err, &httpError), errors.Is(err, provider.ErrUnavailable):
		return errors.New("refinement provider is unavailable; no text was changed")
	case errors.Is(err, provider.ErrInvalidResponse), errors.Is(err, refine.ErrInvalidOutput):
		return errors.New("refinement provider returned an unusable result; no text was changed")
	default:
		return err
	}
}

func firstNonempty(values ...string) string {
	for _, value := range values {
		if value != "" {
			return value
		}
	}
	return ""
}
