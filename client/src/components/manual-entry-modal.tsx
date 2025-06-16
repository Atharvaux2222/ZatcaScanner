import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { InsertScannedQR } from "@shared/schema";
import { PlusCircle, X } from "lucide-react";

interface ManualEntryModalProps {
  isOpen: boolean;
  onClose: () => void;
  sessionId: string;
  onSuccess?: () => void;
}

const manualEntrySchema = z.object({
  sellerName: z.string().min(1, "Seller name is required"),
  vatNumber: z.string().min(1, "VAT number is required"),
  invoiceNumber: z.string().min(1, "Invoice number is required"),
  invoiceDate: z.string().min(1, "Invoice date is required"),
  subtotal: z.string().min(1, "Subtotal is required").refine((val) => !isNaN(Number(val)) && Number(val) >= 0, "Must be a valid positive number"),
  vatAmount: z.string().min(1, "VAT amount is required").refine((val) => !isNaN(Number(val)) && Number(val) >= 0, "Must be a valid positive number"),
  totalAmount: z.string().min(1, "Total amount is required").refine((val) => !isNaN(Number(val)) && Number(val) >= 0, "Must be a valid positive number"),
  notes: z.string().optional(),
});

type ManualEntryFormData = z.infer<typeof manualEntrySchema>;

export default function ManualEntryModal({ isOpen, onClose, sessionId, onSuccess }: ManualEntryModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<ManualEntryFormData>({
    resolver: zodResolver(manualEntrySchema),
    defaultValues: {
      sellerName: "",
      vatNumber: "",
      invoiceNumber: "",
      invoiceDate: "",
      subtotal: "",
      vatAmount: "",
      totalAmount: "",
      notes: "",
    },
  });

  const addManualEntryMutation = useMutation({
    mutationFn: async (data: ManualEntryFormData) => {
      const qrRecord: InsertScannedQR = {
        sessionId,
        rawData: `Manual Entry: ${data.invoiceNumber}`,
        sellerName: data.sellerName,
        vatNumber: data.vatNumber,
        invoiceNumber: data.invoiceNumber,
        invoiceDate: data.invoiceDate,
        subtotal: data.subtotal,
        vatAmount: data.vatAmount,
        totalAmount: data.totalAmount,
        status: 'valid',
        isManualEntry: true,
        notes: data.notes || null,
      };

      const response = await apiRequest('POST', '/api/qr-codes', qrRecord);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/qr-codes', sessionId] });
      queryClient.invalidateQueries({ queryKey: ['/api/sessions', sessionId, 'stats'] });
      
      toast({
        title: "Success",
        description: "Manual entry added successfully",
      });

      form.reset();
      onClose();
      onSuccess?.();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to add manual entry. Please try again.",
        variant: "destructive",
      });
      console.error('Manual entry error:', error);
    },
  });

  const handleSubmit = (data: ManualEntryFormData) => {
    addManualEntryMutation.mutate(data);
  };

  const handleClose = () => {
    form.reset();
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="glass max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold text-foreground">
            Manual Entry
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            Enter ZATCA QR invoice details manually when scanning is not possible
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="sellerName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-medium text-foreground">Seller Name *</FormLabel>
                  <FormControl>
                    <Input {...field} className="glass-input" placeholder="Enter seller name" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="vatNumber"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-medium text-foreground">VAT Number *</FormLabel>
                  <FormControl>
                    <Input {...field} className="glass-input" placeholder="Enter VAT number" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="invoiceNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-medium text-foreground">Invoice Number *</FormLabel>
                    <FormControl>
                      <Input {...field} className="glass-input" placeholder="Invoice #" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="invoiceDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-medium text-foreground">Invoice Date *</FormLabel>
                    <FormControl>
                      <Input {...field} type="date" className="glass-input" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <FormField
                control={form.control}
                name="subtotal"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-medium text-foreground">Subtotal (SAR) *</FormLabel>
                    <FormControl>
                      <Input {...field} type="number" step="0.01" min="0" className="glass-input" placeholder="0.00" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="vatAmount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-medium text-foreground">VAT Amount *</FormLabel>
                    <FormControl>
                      <Input {...field} type="number" step="0.01" min="0" className="glass-input" placeholder="0.00" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="totalAmount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm font-medium text-foreground">Total Amount *</FormLabel>
                    <FormControl>
                      <Input {...field} type="number" step="0.01" min="0" className="glass-input" placeholder="0.00" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm font-medium text-foreground">Notes (Optional)</FormLabel>
                  <FormControl>
                    <Textarea {...field} className="glass-input resize-none" placeholder="Add any additional notes..." rows={3} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                className="glass-button flex-1"
                disabled={addManualEntryMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/20 flex-1"
                disabled={addManualEntryMutation.isPending}
              >
                {addManualEntryMutation.isPending ? (
                  "Adding..."
                ) : (
                  <>
                    <PlusCircle className="w-4 h-4 mr-2" />
                    Add Entry
                  </>
                )}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}