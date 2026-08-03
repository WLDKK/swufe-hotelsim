import { signOutAction } from "@/components/auth/sign-out-action";
import { Button } from "@/components/ui/button";

type SignOutButtonProps = {
  className?: string;
  label?: string;
};

export function SignOutButton({
  className,
  label = "Sign out",
}: SignOutButtonProps) {
  return (
    <form
      action={signOutAction}
    >
      <Button type="submit" variant="outline" size="sm" className={className}>
        {label}
      </Button>
    </form>
  );
}
