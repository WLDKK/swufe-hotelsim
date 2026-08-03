import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ActionLink = {
  href: string;
  label: string;
};

type PagePlaceholderProps = {
  eyebrow: string;
  title: string;
  description: string;
  actions?: ActionLink[];
};

export function PagePlaceholder({
  eyebrow,
  title,
  description,
  actions = [],
}: PagePlaceholderProps) {
  // Every scaffold page uses the same wrapper so later stage work can swap the
  // inside content without rethinking spacing, cards, and action link styling.
  return (
    <main className="mx-auto flex min-h-[calc(100vh-8rem)] w-full max-w-5xl items-center px-6 py-12 md:px-10">
      <Card className="w-full border-border/70 bg-background/95 shadow-sm">
        <CardHeader className="space-y-4">
          <Badge variant="secondary" className="w-fit">
            {eyebrow}
          </Badge>
          <div className="space-y-2">
            <CardTitle className="text-3xl tracking-tight">{title}</CardTitle>
            <CardDescription className="max-w-2xl text-base leading-7">
              {description}
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          {actions.map((action) => (
            <Link
              key={action.href}
              href={action.href}
              className={cn(buttonVariants({ variant: "outline" }), "gap-2")}
            >
              {action.label}
              <ArrowRight className="size-4" />
            </Link>
          ))}
        </CardContent>
      </Card>
    </main>
  );
}
