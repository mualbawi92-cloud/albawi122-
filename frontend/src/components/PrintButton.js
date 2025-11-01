import React, { useRef } from 'react';
import { useReactToPrint } from 'react-to-print';
import { Button } from './ui/button';

/**
 * PrintButton Component
 * Reusable print button that can print any React component
 * 
 * Usage:
 * <PrintButton
 *   componentToPrint={<YourComponent data={data} />}
 *   buttonText="طباعة"
 *   fileName="document.pdf"
 * />
 */
const PrintButton = ({ 
  componentToPrint, 
  buttonText = "🖨️ طباعة", 
  buttonVariant = "outline",
  buttonClassName = "",
  fileName = "document",
  disabled = false 
}) => {
  const componentRef = useRef();

  const handlePrint = useReactToPrint({
    content: () => componentRef.current,
    documentTitle: fileName,
    pageStyle: `
      @page {
        size: A4;
        margin: 20mm;
      }
      @media print {
        body {
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
        .no-print {
          display: none !important;
        }
      }
    `
  });

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
      
      {/* Hidden component for printing */}
      <div style={{ display: 'none' }}>
        <div ref={componentRef}>
          {componentToPrint}
        </div>
      </div>
    </>
  );
};

export default PrintButton;
