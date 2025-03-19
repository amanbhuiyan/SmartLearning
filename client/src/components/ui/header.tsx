import { GraduationCap } from "lucide-react";
import { UserProfileDropdown } from "./user-profile";
import { Link } from "wouter";

export function Header() {
  return (
    <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <GraduationCap className="h-6 w-6 text-primary" />
          <span className="text-xl font-bold">EduQuest</span>
        </Link>
        <UserProfileDropdown />
      </div>
    </header>
  );
}
