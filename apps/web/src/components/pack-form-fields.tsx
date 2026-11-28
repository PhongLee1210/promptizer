import type { CategoryFieldErrors } from "@promptizer/shared";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

export interface PackFormValues {
  name: string;
}

interface PackFormFieldsProps {
  values: PackFormValues;
  fieldErrors: CategoryFieldErrors;
  onChange(values: PackFormValues): void;
}

export function PackFormFields({ values, fieldErrors, onChange }: PackFormFieldsProps) {
  return (
    <FieldGroup>
      <Field data-invalid={fieldErrors.name ? true : undefined}>
        <FieldLabel htmlFor="pack-name">Name</FieldLabel>
        <Input
          id="pack-name"
          name="name"
          value={values.name}
          onChange={(event) => onChange({ name: event.target.value })}
          aria-invalid={fieldErrors.name ? true : undefined}
        />
        {fieldErrors.name && <FieldError>{fieldErrors.name}</FieldError>}
      </Field>
    </FieldGroup>
  );
}
