import React, { useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { Button } from './ui/button';

/**
 * PrintButton Component  
 * Simple and effective print button
 */
const PrintButton = ({ 
  componentToPrint, 
  buttonText = "🖨️ طباعة", 
  buttonVariant = "outline",
  buttonClassName = "",
  disabled = false 
}) => {
  const rootRef = useRef(null);

  const handlePrint = () => {
    // Create print container if it doesn't exist
    let printContainer = document.getElementById('print-root');
    if (!printContainer) {
      printContainer = document.createElement('div');
      printContainer.id = 'print-root';
      printContainer.style.display = 'none';
      document.body.appendChild(printContainer);
    }

    // Add print styles if they don't exist
    let printStyles = document.getElementById('print-styles');
    if (!printStyles) {
      printStyles = document.createElement('style');
      printStyles.id = 'print-styles';
      printStyles.innerHTML = `
        @media print {
          body * {
            visibility: hidden;
          }
          
          #print-root,
          #print-root * {
            visibility: visible;
          }
          
          #print-root {
            position: absolute;
            left: 0;
            top: 0;
            display: block !important;
            width: 100%;
          }
          
          @page {
            size: A4;
            margin: 15mm;
          }
        }
      `;
      document.head.appendChild(printStyles);
    }

    // Create root and render
    if (!rootRef.current) {
      rootRef.current = createRoot(printContainer);
    }
    
    rootRef.current.render(componentToPrint);
    
    // Trigger print after short delay to ensure rendering
    setTimeout(() => {
      window.print();
    }, 300);
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
