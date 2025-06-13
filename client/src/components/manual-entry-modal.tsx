import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
        <DialogHeader className="flex flex-row items-center justify-between">
          <DialogTitle className="text-lg font-semibold text-foreground">
            Manual Entry
          </DialogTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClose}
            className="glass-button p-2"
          >
            <X className="w-4 h-4" />
          </Button>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="sellerName" className="text-sm font-medium text-foreground">
              Seller Name *
            </Label>
            <Input
              id="sellerName"
              {...form.register("sellerName")}
              className="glass-input"
              placeholder="Enter seller name"
            />
            {form.formState.errors.sellerName && (
              <p className="text-sm text-destructive">{form.formState.errors.sellerName.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="vatNumber" className="text-sm font-medium text-foreground">
              VAT Number *
            </Label>
            <Input
              id="vatNumber"
              {...form.register("vatNumber")}
              className="glass-input"
              placeholder="Enter VAT number"
            />
            {form.formState.errors.vatNumber && (
              <p className="text-sm text-destructive">{form.formState.errors.vatNumber.message}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="invoiceNumber" className="text-sm font-medium text-foreground">
                Invoice Number *
              </Label>
              <Input
                id="invoiceNumber"
                {...form.register("invoiceNumber")}
                className="glass-input"
                placeholder="Invoice #"
              />
              {form.formState.errors.invoiceNumber && (
                <p className="text-sm text-destructive">{form.formState.errors.invoiceNumber.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="invoiceDate" className="text-sm font-medium text-foreground">
                Invoice Date *
              </Label>
              <Input
                id="invoiceDate"
                type="date"
                {...form.register("invoiceDate")}
                className="glass-input"
              />
              {form.formState.errors.invoiceDate && (
                <p className="text-sm text-destructive">{form.formState.errors.invoiceDate.message}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="subtotal" className="text-sm font-medium text-foreground">
                Subtotal (SAR) *
              </Label>
              <Input
                id="subtotal"
                type="number"
                step="0.01"
                min="0"
                {...form.register("subtotal")}
                className="glass-input"
                placeholder="0.00"
              />
              {form.formState.errors.subtotal && (
                <p className="text-sm text-destructive">{form.formState.errors.subtotal.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="vatAmount" className="text-sm font-medium text-foreground">
                VAT Amount *
              </Label>
              <Input
                id="vatAmount"
                type="number"
                step="0.01"
                min="0"
                {...form.register("vatAmount")}
                className="glass-input"
                placeholder="0.00"
              />
              {form.formState.errors.vatAmount && (
                <p className="text-sm text-destructive">{form.formState.errors.vatAmount.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="totalAmount" className="text-sm font-medium text-foreground">
                Total Amount *
              </Label>
              <Input
                id="totalAmount"
                type="number"
                step="0.01"
                min="0"
                {...form.register("totalAmount")}
                className="glass-input"
                placeholder="0.00"
              />
              {form.formState.errors.totalAmount && (
                <p className="text-sm text-destructive">{form.formState.errors.totalAmount.message}</p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes" className="text-sm font-medium text-foreground">
              Notes (Optional)
            </Label>
            <Textarea
              id="notes"
              {...form.register("notes")}
              className="glass-input resize-none"
              placeholder="Add any additional notes..."
              rows={3}
            />
          </div>

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
      </DialogContent>
    </Dialog>
  );
}