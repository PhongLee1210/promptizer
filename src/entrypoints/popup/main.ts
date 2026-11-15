import "../../styles/base.css";
import "../../styles/states.css";
import "../../styles/popup.css";
import { mountPopup } from "../../popup/app";

const app = document.querySelector<HTMLElement>("#app");

if (app !== null) {
  void mountPopup(app);
}
