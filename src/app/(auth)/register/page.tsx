import { RegisterForm } from "@/components/auth/register-form";

export default function RegisterPage() {
  return (
    // Registration currently focuses on student self-service, which keeps the
    // teacher/admin bootstrap path separate from routine course onboarding.
    <RegisterForm />
  );
}
