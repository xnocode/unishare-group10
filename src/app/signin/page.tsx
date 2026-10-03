import { redirect } from "next/navigation";

export default function SigninRedirect() {
  redirect("/login");
}
