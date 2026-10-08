import { redirect } from "next/navigation";

export default function RootPage() {
  // Whenever user opens or clicks localhost:3000, open Login Page first
  redirect("/login");
}
