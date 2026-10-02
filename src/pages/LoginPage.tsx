import { LoginForm } from "../components/auth/LoginForm";
import { AuthLayout } from "../components/layout/AuthLayout";
import { useDocumentTitle } from "../hooks/useDocumentTitle";

/** /login — private login (no sign-up, no password reset). */
export default function LoginPage() {
  useDocumentTitle("Anmelden");
  return (
    <AuthLayout>
      <LoginForm />
    </AuthLayout>
  );
}
