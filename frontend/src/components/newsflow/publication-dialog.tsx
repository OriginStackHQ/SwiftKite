"use client";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useDemo } from "./store";
const schema = z.object({
  name: z.string().trim().min(2, "Enter a publication name").max(60),
  description: z.string().trim().min(10, "Add a short description").max(160),
  senderName: z.string().trim().min(2, "Enter a sender name").max(60),
  senderEmail: z.string().trim().email("Enter a valid email"),
  replyTo: z.string().trim().email("Enter a valid email"),
});
type Values = z.infer<typeof schema>;
const newPublicationId = () => `pub_${Math.random().toString(36).slice(2, 8)}`;
const todayISO = () => new Date().toISOString().slice(0, 10);
export function CreatePublicationDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { setPublications } = useDemo();
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: "",
      description: "",
      senderName: "",
      senderEmail: "",
      replyTo: "",
    },
  });
  const submit = (v: Values) => {
    const id = newPublicationId();
    setPublications((p) => [
      { ...v, id, status: "Active", created: todayISO() },
      ...p,
    ]);
    toast.success(`${v.name} created in this demo workspace`);
    form.reset();
    onOpenChange(false);
  };
  const f = (name: keyof Values, label: string, area = false) => (
    <div className="form-field">
      <label htmlFor={name}>{label}</label>
      {area ? (
        <Textarea id={name} {...form.register(name)} />
      ) : (
        <Input id={name} {...form.register(name)} />
      )}
      {form.formState.errors[name] && (
        <span className="text-xs text-destructive">
          {form.formState.errors[name]?.message}
        </span>
      )}
    </div>
  );
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-auto bg-card sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Create publication</DialogTitle>
          <DialogDescription>
            Set up a new newsletter and its sender details.
          </DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={form.handleSubmit(submit)}>
          {f("name", "Publication name")}
          {f("description", "Short description", true)}
          <div className="form-grid">
            {f("senderName", "Sender name")}
            {f("senderEmail", "Sender email")}
          </div>
          {f("replyTo", "Reply-to email")}
          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit">Create publication</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
