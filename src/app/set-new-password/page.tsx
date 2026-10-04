import { redirect } from "next/navigation";

export default function SetNewPasswordRedirect() {
  redirect("/reset-password");
}
