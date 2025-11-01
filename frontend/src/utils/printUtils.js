/**
 * Print Utility
 * Simple and effective printing by opening a new window
 */

export const printDocument = (htmlContent, title = 'طباعة') => {
  // Open new window
  const printWindow = window.open('', '_blank', 'width=800,height=600');
  
  if (!printWindow) {
    alert('يرجى السماح بفتح النوافذ المنبثقة للطباعة');
    return;
  }

  // Write HTML content
  printWindow.document.write(`
    <!DOCTYPE html>
    <html dir="rtl" lang="ar">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${title}</title>
      <style>
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        
        body {
          font-family: 'Arial', 'Helvetica', sans-serif;
          direction: rtl;
          padding: 20px;
          background: white;
          color: #000;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
        
        /* Print-specific styles */
        @media print {
          body {
            padding: 0;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          
          @page {
            size: A4;
            margin: 15mm;
          }
          
          /* Prevent page breaks inside elements */
          table, .no-break {
            page-break-inside: avoid;
          }
          
          /* Allow breaks before these elements */
          h1, h2, h3 {
            page-break-after: avoid;
          }
        }
        
        /* Common styles */
        table {
          width: 100%;
          border-collapse: collapse;
          margin: 15px 0;
          font-size: 11px;
        }
        
        table th, table td {
          border: 1px solid #ddd;
          padding: 8px;
          text-align: right;
        }
        
        table th {
          background-color: #f3f4f6;
          font-weight: bold;
          color: #1e40af;
        }
        
        table tr:nth-child(even) {
          background-color: #f9fafb;
        }
        
        h1, h2, h3 {
          color: #1e40af;
          margin: 10px 0;
        }
        
        .header {
          text-align: center;
          border-bottom: 3px solid #2563eb;
          padding-bottom: 15px;
          margin-bottom: 20px;
        }
        
        .header-info {
          display: flex;
          justify-content: space-between;
          background-color: #f3f4f6;
          padding: 10px;
          border-radius: 5px;
          margin-bottom: 15px;
          font-size: 12px;
        }
        
        .footer {
          margin-top: 30px;
          padding-top: 15px;
          border-top: 3px solid #2563eb;
          text-align: center;
          font-size: 12px;
          color: #64748b;
        }
        
        .summary-card {
          display: inline-block;
          padding: 10px 15px;
          margin: 5px;
          border-radius: 5px;
          border: 2px solid #e5e7eb;
          background-color: #f9fafb;
        }
        
        .summary-label {
          font-size: 11px;
          color: #64748b;
          margin-bottom: 5px;
        }
        
        .summary-value {
          font-size: 16px;
          font-weight: bold;
          color: #1e40af;
        }
      </style>
    </head>
    <body>
      ${htmlContent}
      
      <script>
        // Auto print when page loads
        window.onload = function() {
          setTimeout(function() {
            window.print();
          }, 500);
        };
        
        // Close window after printing (optional)
        window.onafterprint = function() {
          setTimeout(function() {
            window.close();
          }, 500);
        };
      </script>
    </body>
    </html>
  `);
  
  printWindow.document.close();
};

/**
 * Generate Transfer Receipt HTML
 */
export const generateTransferReceiptHTML = (transfer, agentInfo, currentUser) => {
  const formatCurrency = (amount, currency = 'IQD') => {
    return `${amount?.toLocaleString() || 0} ${currency}`;
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleString('ar-IQ');
  };

  const printDate = new Date().toLocaleString('ar-IQ');

  return `
    <div class="header">
      <div style="font-size: 36px; margin-bottom: 10px;">💼</div>
      <h1 style="font-size: 24px; margin: 0;">نظام إدارة الحوالات المالية</h1>
    </div>

    <div class="header-info">
      <div><strong>📅 تاريخ الطباعة:</strong> ${printDate}</div>
      <div><strong>👤 المستخدم:</strong> ${currentUser?.display_name || currentUser?.username || 'النظام'}</div>
    </div>

    <h2 style="text-align: center; margin-bottom: 20px;">
      ${transfer.status === 'completed' ? '📥 إيصال استلام حوالة' : '📤 إيصال إرسال حوالة'}
    </h2>

    <div style="background: #dbeafe; padding: 15px; border-radius: 8px; text-align: center; margin-bottom: 20px; border: 2px solid #3b82f6;">
      <div style="font-size: 12px; color: #1e40af; margin-bottom: 5px;"><strong>رقم الحوالة</strong></div>
      <div style="font-size: 24px; font-weight: bold; color: #1e3a8a; letter-spacing: 2px;">
        ${transfer.code || transfer.transfer_code || '-'}
      </div>
    </div>

    <h3>📋 تفاصيل الحوالة</h3>
    <table>
      <tr>
        <td style="width: 30%; font-weight: bold; background: #f9fafb;">التاريخ</td>
        <td>${formatDate(transfer.created_at)}</td>
      </tr>
      <tr>
        <td style="font-weight: bold; background: #f9fafb;">المبلغ</td>
        <td style="font-size: 16px; font-weight: bold; color: #059669;">
          ${formatCurrency(transfer.amount, transfer.currency)}
        </td>
      </tr>
      ${(transfer.outgoing_commission > 0 || transfer.incoming_commission > 0) ? `
      <tr>
        <td style="font-weight: bold; background: #f9fafb;">العمولة</td>
        <td style="color: #dc2626;">
          ${formatCurrency(transfer.outgoing_commission || transfer.incoming_commission, transfer.currency)}
        </td>
      </tr>
      ` : ''}
      <tr>
        <td style="font-weight: bold; background: #f9fafb;">الحالة</td>
        <td>
          <span style="padding: 4px 12px; border-radius: 4px; background: ${
            transfer.status === 'completed' ? '#d1fae5' : 
            transfer.status === 'pending' ? '#fef3c7' : '#fee2e2'
          }; color: ${
            transfer.status === 'completed' ? '#065f46' : 
            transfer.status === 'pending' ? '#92400e' : '#991b1b'
          }; font-weight: bold;">
            ${transfer.status === 'completed' ? '✅ مسلّمة' : 
              transfer.status === 'pending' ? '⏳ قيد الانتظار' : '❌ ملغاة'}
          </span>
        </td>
      </tr>
    </table>

    <h3 style="margin-top: 20px;">👥 معلومات الأطراف</h3>
    <table>
      <tr>
        <td colspan="2" style="background: #fef3c7; font-weight: bold; color: #92400e;">📤 المرسل</td>
      </tr>
      <tr>
        <td style="width: 30%; font-weight: bold; background: #f9fafb;">الاسم</td>
        <td>${transfer.sender_name || '-'}</td>
      </tr>
      <tr>
        <td style="font-weight: bold; background: #f9fafb;">الهاتف</td>
        <td>${transfer.sender_phone || '-'}</td>
      </tr>
      <tr>
        <td style="font-weight: bold; background: #f9fafb;">الموقع</td>
        <td>${transfer.from_governorate || '-'}</td>
      </tr>
      <tr>
        <td colspan="2" style="background: #d1fae5; font-weight: bold; color: #065f46;">📥 المستلم</td>
      </tr>
      <tr>
        <td style="font-weight: bold; background: #f9fafb;">الاسم</td>
        <td>${transfer.receiver_name || '-'}</td>
      </tr>
      <tr>
        <td style="font-weight: bold; background: #f9fafb;">الهاتف</td>
        <td>${transfer.receiver_phone || '-'}</td>
      </tr>
      <tr>
        <td style="font-weight: bold; background: #f9fafb;">الموقع</td>
        <td>${transfer.to_governorate || '-'}</td>
      </tr>
    </table>

    ${agentInfo ? `
    <h3 style="margin-top: 20px;">🏢 معلومات الصراف</h3>
    <table>
      <tr>
        <td style="width: 30%; font-weight: bold; background: #f9fafb;">الاسم</td>
        <td>${agentInfo.display_name || '-'}</td>
      </tr>
      <tr>
        <td style="font-weight: bold; background: #f9fafb;">الموقع</td>
        <td>${agentInfo.governorate || '-'}</td>
      </tr>
      ${agentInfo.phone_number ? `
      <tr>
        <td style="font-weight: bold; background: #f9fafb;">الهاتف</td>
        <td>${agentInfo.phone_number}</td>
      </tr>
      ` : ''}
    </table>
    ` : ''}

    ${transfer.notes ? `
    <h3 style="margin-top: 20px;">📝 ملاحظات</h3>
    <div style="padding: 10px; background: #f3f4f6; border-radius: 5px; font-size: 13px;">
      ${transfer.notes}
    </div>
    ` : ''}

    <div class="footer">
      <p style="margin-bottom: 5px;">هذا الإيصال صادر إلكترونياً ولا يحتاج إلى ختم أو توقيع</p>
      <p style="font-weight: bold; color: #1e40af; margin: 5px 0;">
        تمت الطباعة بواسطة نظام الحوالات
      </p>
      <p style="font-size: 11px;">© ${new Date().getFullYear()} جميع الحقوق محفوظة</p>
    </div>
  `;
};

/**
 * Generate Accounting Report HTML
 */
export const generateAccountingReportHTML = (title, subtitle, dateRange, summary, data, columns, currentUser) => {
  const printDate = new Date().toLocaleString('ar-IQ');

  const summaryHTML = summary.map(item => `
    <div class="summary-card" style="border-color: ${item.borderColor}; background-color: ${item.color};">
      <div class="summary-label">${item.label}</div>
      <div class="summary-value" style="color: ${item.textColor};">${item.value}</div>
    </div>
  `).join('');

  const tableHeaderHTML = columns.map(col => `
    <th style="text-align: ${col.align || 'right'};">${col.header}</th>
  `).join('');

  const tableBodyHTML = data.map((row, idx) => `
    <tr>
      ${columns.map(col => {
        let value = row[col.field];
        if (col.render) {
          value = col.render(value, row);
        }
        return `
          <td style="
            text-align: ${col.align || 'right'}; 
            font-weight: ${col.bold ? 'bold' : 'normal'};
            ${col.color ? `color: ${typeof col.color === 'function' ? col.color(row[col.field]) : col.color};` : ''}
          ">
            ${value}
          </td>
        `;
      }).join('')}
    </tr>
  `).join('');

  return `
    <div class="header">
      <div style="font-size: 32px; margin-bottom: 8px;">💼</div>
      <h1 style="font-size: 22px; margin: 0;">نظام إدارة الحوالات المالية</h1>
    </div>

    <div class="header-info">
      <div><strong>📅 تاريخ الطباعة:</strong> ${printDate}</div>
      <div><strong>👤 المستخدم:</strong> ${currentUser?.display_name || currentUser?.username || 'النظام'}</div>
    </div>

    <div style="text-align: center; margin-bottom: 20px;">
      <h2 style="font-size: 20px; margin: 0 0 5px 0;">${title}</h2>
      ${subtitle ? `<p style="font-size: 14px; color: #64748b; margin: 5px 0;">${subtitle}</p>` : ''}
      ${dateRange ? `<p style="font-size: 13px; color: #64748b; font-weight: bold; margin: 5px 0;">📅 الفترة: ${dateRange}</p>` : ''}
    </div>

    ${summary.length > 0 ? `
      <div style="text-align: center; margin-bottom: 20px;">
        ${summaryHTML}
      </div>
    ` : ''}

    ${data.length > 0 ? `
      <table>
        <thead>
          <tr>${tableHeaderHTML}</tr>
        </thead>
        <tbody>
          ${tableBodyHTML}
        </tbody>
      </table>
    ` : '<p style="text-align: center; padding: 30px; background: #f3f4f6; border-radius: 8px; color: #64748b;">لا توجد بيانات للعرض</p>'}

    <div class="footer">
      <p style="font-weight: bold; color: #1e40af; margin: 5px 0;">
        تمت الطباعة بواسطة نظام الحوالات
      </p>
      <p style="font-size: 11px;">© ${new Date().getFullYear()} جميع الحقوق محفوظة</p>
    </div>
  `;
};
