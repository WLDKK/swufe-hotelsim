import { LoginForm } from "@/components/auth/login-form";

type LoginPageProps = {
  searchParams?: Promise<{
    callbackUrl?: string;
  }>;
};

export default async function LoginPage(props: LoginPageProps) {
  const searchParams = await props.searchParams;
  return (
    // Keep the login page server-rendered so callbackUrl can flow in from
    // middleware redirects without adding client-side routing glue.
    <LoginForm callbackUrl={searchParams?.callbackUrl} />
  );
}
