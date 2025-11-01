import React from 'react';
import { Button } from './ui/button';

/**
 * PrintButton Component
 * Simple print button that opens print dialog
 * 
 * Usage:
 * <PrintButton
 *   content={<YourComponent />}
 *   buttonText="طباعة"
 * />
 */
const PrintButton = ({ 
  componentToPrint, 
  buttonText = "🖨️ طباعة", 
  buttonVariant = "outline",
  buttonClassName = "",
  disabled = false 
}) => {

  const handlePrint = () => {
    // Create a new window for printing
    const printWindow = window.open('', '_blank', 'width=800,height=600');
    
    if (!printWindow) {
      alert('يرجى السماح بفتح النوافذ المنبثقة للطباعة');
      return;
    }

    // Write the content to the new window
    printWindow.document.write(`
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>طباعة</title>
        <style>
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          
          body {
            font-family: Arial, sans-serif;
            direction: rtl;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          
          @media print {
            body {
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
            
            @page {
              size: A4;
              margin: 15mm;
            }
          }
          
          @media screen {
            body {
              padding: 20px;
              background: #f5f5f5;
            }
            
            #print-content {
              background: white;
              padding: 40px;
              max-width: 210mm;
              margin: 0 auto;
              box-shadow: 0 0 10px rgba(0,0,0,0.1);
            }
          }
        </style>
      </head>
      <body>
        <div id="print-content"></div>
        <script>
          // Auto print after content loads
          window.onload = function() {
            setTimeout(function() {
              window.print();
            }, 500);
          };
          
          // Close window after printing
          window.onafterprint = function() {
            setTimeout(function() {
              window.close();
            }, 100);
          };
        </script>
      </body>
      </html>
    `);

    // Get the component HTML
    const tempDiv = document.createElement('div');
    const root = document.createElement('div');
    tempDiv.appendChild(root);
    
    // Clone the component
    const componentClone = document.createElement('div');
    componentClone.innerHTML = tempDiv.innerHTML;
    
    // Insert component directly
    const printContent = printWindow.document.getElementById('print-content');
    if (printContent) {
      // Render React component to string
      import('react-dom/server').then(({ renderToString }) => {
        const htmlString = renderToString(componentToPrint);
        printContent.innerHTML = htmlString;
        printWindow.document.close();
      }).catch(() => {
        // Fallback: just insert as HTML
        printContent.innerHTML = componentToPrint.toString();
        printWindow.document.close();
      });
    }
  };

  return (
    <Button 
      variant={buttonVariant}
      onClick={handlePrint}
      disabled={disabled}
      className={buttonClassName}
      type="button"
    >
      {buttonText}
    </Button>
  );
};

export default PrintButton;
