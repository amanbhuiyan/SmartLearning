import { useQuery } from "@tanstack/react-query";
import { Question } from "@shared/schema";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";

export default function HomePage() {
  const { user, logoutMutation } = useAuth();
  const { toast } = useToast();

  const { data: questions, error } = useQuery<Question[]>({
    queryKey: ["/api/questions"],
  });

  if (error) {
    if ((error as any).status === 402) {
      return (
        <div className="container mx-auto px-4 py-8">
          <Card>
            <CardHeader>
              <CardTitle>Subscription Required</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="mb-4">Please subscribe to access daily questions.</p>
              <Link href="/subscribe">
                <Button>Subscribe Now</Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      );
    }
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">Welcome, {user?.username}!</h1>
        <Button variant="outline" onClick={() => logoutMutation.mutate()}>
          Logout
        </Button>
      </div>

      <div className="grid gap-6">
        {questions?.map((q) => (
          <Card key={q.id}>
            <CardHeader>
              <CardTitle>Question {q.id}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="mb-4">{q.question}</p>
              <details className="text-sm">
                <summary className="cursor-pointer text-primary">Show Answer</summary>
                <p className="mt-2">{q.answer}</p>
                {q.explanation && (
                  <p className="mt-2 text-muted-foreground">{q.explanation}</p>
                )}
              </details>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
