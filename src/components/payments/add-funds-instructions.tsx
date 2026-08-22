import { Info } from "lucide-react";

const banglaInstructions = [
  "নির্বাচিত payment method-এর দেখানো personal number-এ Send Money করুন।",
  "টাকা পাঠানোর আগে number ও amount ভালোভাবে মিলিয়ে নিন।",
  "টাকা পাঠানোর পর Sender Number, Amount এবং Transaction ID সঠিকভাবে পূরণ করুন।",
  "Submit করার পর Admin manually transaction verify করবে।",
  "Verification successful হলে সাধারণত 1–5 মিনিটের মধ্যে balance manually add করা হবে।",
  "ভুল তথ্য দিলে approval delay হতে পারে।",
];

const englishInstructions = [
  "Send Money to the personal number shown for the selected payment method.",
  "Verify the number and amount before sending.",
  "After payment, enter the Sender Number, Amount and Transaction ID correctly.",
  "Our Admin team will manually verify the transaction.",
  "After successful verification, balance will normally be added manually within 1–5 minutes.",
  "Incorrect information may delay approval.",
];

export function AddFundsInstructions() {
  return (
    <div className="glass-card rounded-xl p-5">
      <div className="mb-4 flex items-center gap-2">
        <Info className="h-4 w-4 text-primary" />
        <h2 className="text-sm font-bold">Payment Instructions · পেমেন্ট নির্দেশনা</h2>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            বাংলা
          </p>
          <ul className="space-y-1.5 text-xs text-muted-foreground">
            {banglaInstructions.map((line) => (
              <li key={line} className="flex gap-2">
                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-primary" />
                <span>{line}</span>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            English
          </p>
          <ul className="space-y-1.5 text-xs text-muted-foreground">
            {englishInstructions.map((line) => (
              <li key={line} className="flex gap-2">
                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-primary" />
                <span>{line}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
