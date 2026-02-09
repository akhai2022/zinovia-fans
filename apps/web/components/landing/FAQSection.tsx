import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Section } from "./Section";

const FAQ_ITEMS = [
  { id: "faq-1", question: "How does subscription billing work?", answer: "You're charged monthly. Cancel anytime; access continues until the end of your billing period." },
  { id: "faq-2", question: "Can I cancel anytime?", answer: "Yes. You keep access until the end of the current period. No refund for the current period per our policy." },
  { id: "faq-3", question: "Is my payment info safe?", answer: "Payments are processed securely. We don't store full card details. Checkout is secure." },
  { id: "faq-4", question: "What's your refund policy?", answer: "Refunds are handled per our policy. Contact support for eligible cases." },
  { id: "faq-5", question: "Who can see my content?", answer: "You choose: public, followers only, or subscribers only." },
  { id: "faq-6", question: "How do creator payouts work?", answer: "Regular schedule to your bank. Fees are shown in your dashboard." },
] as const;

export function FAQSection() {
  return (
    <Section id="faq" title="Common questions" tone="muted" aria-labelledby="faq-heading">
      <div className="max-w-2xl">
        <Accordion defaultValue="faq-1">
          {FAQ_ITEMS.map(({ id, question, answer }) => (
            <AccordionItem key={id} value={id}>
              <AccordionTrigger value={id}>{question}</AccordionTrigger>
              <AccordionContent value={id}>{answer}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </Section>
  );
}
