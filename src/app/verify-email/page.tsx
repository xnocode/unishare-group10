import { redirect } from "next/navigation";

export default function VerifyEmailPage() {
  redirect("/confirm-email");
}
