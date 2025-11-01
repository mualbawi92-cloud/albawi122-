import React, { useState } from 'react';
import { Button } from './ui/button';
import { Dialog, DialogContent } from './ui/dialog';

/**
 * PrintButton Component
 * Simple print button using window.print()
 */
const PrintButton = ({ 
  componentToPrint, 
  buttonText = "🖨️ طباعة", 
  buttonVariant = "outline",
  buttonClassName = "",
  disabled = false 
}) => {
  const [showPrintPreview, setShowPrintPreview] = useState(false);

  const handlePrint = () => {
    setShowPrintPreview(true);
    // Wait for dialog to render then print
    setTimeout(() => {
      window.print();
      setShowPrintPreview(false);
    }, 500);
  };

  return (
    <>
      <Button 
        variant={buttonVariant}
        onClick={handlePrint}
        disabled={disabled}
        className={buttonClassName}
      >
        {buttonText}
      </Button>
      
      {/* Print Dialog */}
      {showPrintPreview && (
        <Dialog open={showPrintPreview} onOpenChange={setShowPrintPreview}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-auto print-content">
            <style>{`
              @media print {
                body * {
                  visibility: hidden;
                }
                .print-content, .print-content * {
                  visibility: visible;
                }
                .print-content {
                  position: absolute;
                  left: 0;
                  top: 0;
                  width: 100%;
                }
                /* Hide dialog close button when printing */
                button[aria-label="Close"] {
                  display: none !important;
                }
              }
            `}</style>
            {componentToPrint}
          </DialogContent>
        </Dialog>
      )}
    </>
  );
};

export default PrintButton;
