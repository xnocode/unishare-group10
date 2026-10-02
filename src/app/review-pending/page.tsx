import { redirect } from "next/navigation";

export default function ReviewPendingRedirect() {
  redirect("/verification-pending");
}
