"use client";

import * as React from "react";

import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type Quote = {
  text: string;
  author: string;
};

const QUOTES: Quote[] = [
  {
    text: "Success is nothing more than a few simple disciplines, practiced every day.",
    author: "Jim Rohn",
  },
  {
    text: "The impediment to action advances action. What stands in the way becomes the way.",
    author: "Marcus Aurelius",
  },
  {
    text: "I am not a product of my circumstances. I am a product of my decisions.",
    author: "Stephen R. Covey",
  },
  {
    text: "He who has a why to live can bear almost any how.",
    author: "Friedrich Nietzsche",
  },
  {
    text: "Suffering ceases to be suffering at the moment it finds a meaning.",
    author: "Viktor E. Frankl",
  },
  {
    text: "If you fell down yesterday, stand up today.",
    author: "H. G. Wells",
  },
  {
    text: "Do not pray for an easy life, pray for the strength to endure a difficult one.",
    author: "Bruce Lee",
  },
  {
    text: "The struggle itself is enough to fill a man's heart.",
    author: "Albert Camus",
  },
  {
    text: "Through discipline comes freedom.",
    author: "Aristotle (attributed)",
  },
  {
    text: "The harder the conflict, the greater the triumph.",
    author: "George Washington",
  },
  {
    text: "Nothing in the world is worth having or worth doing unless it means effort, pain, difficulty.",
    author: "Theodore Roosevelt",
  },
  {
    text: "We must embrace pain and burn it as fuel for our journey.",
    author: "Kenji Miyazawa",
  },
  {
    text: "Man cannot remake himself without suffering.",
    author: "Alexis Carrel",
  },
  {
    text: "I am long and hard on the path that leads to the heights.",
    author: "Vincent van Gogh",
  },
  {
    text: "What you get by achieving your goals is not as important as what you become by achieving your goals.",
    author: "Zig Ziglar",
  },
  {
    text: "Smooth seas do not make skillful sailors.",
    author: "African proverb",
  },
  {
    text: "Fall seven times, stand up eight.",
    author: "Japanese proverb",
  },
  {
    text: "A gem cannot be polished without friction.",
    author: "Chinese proverb",
  },
  {
    text: "Patience is bitter, but its fruit is sweet.",
    author: "Aristotle (ancient Greek proverb, attributed)",
  },
  {
    text: "Little by little, one travels far.",
    author: "J. R. R. Tolkien (based on ancient wisdom)",
  },
  {
    text: "The fire tests gold; adversity tests men.",
    author: "Ancient Greek proverb",
  },
  {
    text: "He who would learn to fly one day must first learn to walk and run.",
    author: "Nietzsche (inspired by classical proverb tradition)",
  },
  {
    text: "Dig the well before you are thirsty.",
    author: "Chinese proverb",
  },
  {
    text: "Adversity makes men, prosperity makes monsters.",
    author: "Latin proverb",
  },
  {
    text: "Endure, and preserve yourself for better things.",
    author: "Virgil",
  },
  {
    text: "The axe forgets; the tree remembers.",
    author: "African proverb",
  },
  {
    text: "No man steps in the same river twice.",
    author: "Heraclitus",
  },
  {
    text: "Difficult roads often lead to beautiful destinations.",
    author: "Persian proverb",
  },
  {
    text: "Through hardship, to the stars. (Per aspera ad astra)",
    author: "Latin proverb",
  },
  {
    text: "The wound is the place where the Light enters you.",
    author: "Rumi",
  },
  {
    text: "I hated every minute of training, but I said, 'Don't quit. Suffer now and live the rest of your life as a champion.'",
    author: "Muhammad Ali",
  },
  {
    text: "I've failed over and over and over again in my life. And that is why I succeed.",
    author: "Michael Jordan",
  },
  {
    text: "Everything negative - pressure, challenges - is all an opportunity for me to rise.",
    author: "Kobe Bryant",
  },
  {
    text: "Champions keep playing until they get it right.",
    author: "Billie Jean King",
  },
  {
    text: "Gold medals aren't really made of gold. They're made of sweat, determination, and a hard-to-find alloy called guts.",
    author: "Jesse Owens",
  },
  {
    text: "You can't put a limit on anything. The more you dream, the farther you get.",
    author: "Michael Phelps",
  },
  {
    text: "I've grown most not from victories, but setbacks.",
    author: "Serena Williams",
  },
  {
    text: "Dreams are free. Goals cost suffering.",
    author: "Usain Bolt",
  },
  {
    text: "Suffering is temporary. Quitting lasts forever.",
    author: "Lance Armstrong (quote stands, regardless of legacy)",
  },
  {
    text: "To give anything less than your best is to sacrifice the gift.",
    author: "Steve Prefontaine",
  },
  {
    text: "The secret of success is consistency of purpose.",
    author: "Eliud Kipchoge",
  },
  {
    text: "You don't get what you wish for. You get what you work for.",
    author: "Tom Brady",
  },
  {
    text: "Pain is temporary. Pride is forever.",
    author: "Evander Holyfield",
  },
  {
    text: "I never lose. I either win or learn.",
    author: "Conor McGregor",
  },
  {
    text: "I knew that if I failed I wouldn't regret that, but I knew the one thing I might regret is not trying.",
    author: "Jeff Bezos",
  },
  {
    text: "It's fine to celebrate success, but it is more important to heed the lessons of failure.",
    author: "Bill Gates",
  },
  {
    text: "If you're not a little embarrassed by the first version of your product, you launched too late.",
    author: "Reid Hoffman",
  },
  {
    text: "Most overnight successes are ten years in the making.",
    author: "Jeff Bezos",
  },
  {
    text: "I didn't get there by wishing for it or hoping for it, but by working for it.",
    author: "Estee Lauder",
  },
  {
    text: "The only way to do great work is to love what you do.",
    author: "Steve Jobs",
  },
  {
    text: "Failure is an option here. If things are not failing, you are not innovating enough.",
    author: "Elon Musk",
  },
  {
    text: "The biggest risk is not taking any risk.",
    author: "Mark Zuckerberg",
  },
  {
    text: "When you find an idea that you just can't stop thinking about, that's probably a good one to pursue.",
    author: "Josh James (Omniture)",
  },
  {
    text: "Success is a lousy teacher. It seduces smart people into thinking they can't lose.",
    author: "Bill Gates",
  },
  {
    text: "You don't learn to walk by following rules. You learn by doing, and by falling over.",
    author: "Richard Branson",
  },
  {
    text: "Chase the vision, not the money; the money will end up following you.",
    author: "Tony Hsieh",
  },
  {
    text: "Patience, persistence, and perspiration make an unbeatable combination for success.",
    author: "Napoleon Hill",
  },
  {
    text: "Nothing works better than just improving your product.",
    author: "Joel Spolsky",
  },
  {
    text: "The way to get started is to quit talking and begin doing.",
    author: "Walt Disney",
  },
];

const ROTATE_INTERVAL_MS = 12000;
const FADE_DURATION_MS = 350;

function shuffleQuotes(items: Quote[]) {
  const shuffled = [...items];
  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j]!, shuffled[i]!];
  }
  return shuffled;
}

export function RotatingQuote({ className }: { className?: string }) {
  const [quotes, setQuotes] = React.useState<Quote[]>([]);
  const [index, setIndex] = React.useState(0);
  const [isFading, setIsFading] = React.useState(false);

  React.useEffect(() => {
    const shuffled = shuffleQuotes(QUOTES);
    setQuotes(shuffled);
    setIndex(0);
  }, []);

  React.useEffect(() => {
    if (quotes.length <= 1) return;

    const interval = window.setInterval(() => {
      setIsFading(true);
    }, ROTATE_INTERVAL_MS);

    return () => window.clearInterval(interval);
  }, [quotes.length]);

  React.useEffect(() => {
    if (!isFading || quotes.length === 0) return;

    const timeout = window.setTimeout(() => {
      setIndex((current) => (current + 1) % quotes.length);
      setIsFading(false);
    }, FADE_DURATION_MS);

    return () => window.clearTimeout(timeout);
  }, [isFading, quotes.length]);

  const current = quotes[index];

  return (
    <Card className={cn("border-border/60 bg-muted/30 shadow-sm", className)}>
      <CardContent className="p-4">
        {current ? (
          <>
            <p
              className={cn(
                "text-sm text-muted-foreground transition-opacity duration-300",
                isFading && "opacity-0",
              )}
            >
              "{current.text}"{" "}
              <span className="whitespace-nowrap text-xs text-muted-foreground/80">
                - {current.author}
              </span>
            </p>
            <div className="relative mt-3 h-px w-full overflow-hidden bg-border/60" aria-hidden="true">
              <div
                key={index}
                className="absolute inset-0 origin-left bg-foreground/25 quote-progress"
                style={
                  {
                    "--quote-progress-duration": `${ROTATE_INTERVAL_MS}ms`,
                  } as React.CSSProperties
                }
              />
            </div>
          </>
        ) : (
          <div className="space-y-2">
            <Skeleton className="h-4 w-[75%]" />
            <Skeleton className="h-3 w-40" />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
