import React from 'react';

/**
 * TransferReceipt Component
 * Printable receipt for transfer transactions with logo and header
 */
const TransferReceipt = ({ transfer, agentInfo, type = 'send', currentUser }) => {
  const formatCurrency = (amount, currency = 'IQD') => {
    return `${amount?.toLocaleString() || 0} ${currency}`;
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleString('ar-IQ', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const printDate = new Date().toLocaleString('ar-IQ', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  return (
    <div style={{ 
      fontFamily: 'Arial, sans-serif',
      direction: 'rtl',
      padding: '30px',
      maxWidth: '210mm', // A4 width
      margin: '0 auto',
      backgroundColor: '#ffffff'
    }}>
      {/* Logo and System Name */}
      <div style={{ 
        textAlign: 'center',
        marginBottom: '20px',
        paddingBottom: '15px',
        borderBottom: '3px solid #2563eb'
      }}>
        <div style={{
          fontSize: '36px',
          fontWeight: 'bold',
          color: '#1e40af',
          marginBottom: '5px'
        }}>
          💼
        </div>
        <h1 style={{ 
          fontSize: '28px', 
          margin: '0',
          color: '#1e40af',
          fontWeight: 'bold'
        }}>
          نظام إدارة الحوالات المالية
        </h1>
      </div>

      {/* Header Info: Date and User */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        padding: '15px',
        backgroundColor: '#f3f4f6',
        borderRadius: '8px',
        marginBottom: '25px',
        fontSize: '14px'
      }}>
        <div>
          <strong>📅 تاريخ الطباعة:</strong> {printDate}
        </div>
        <div>
          <strong>👤 المستخدم:</strong> {currentUser?.display_name || currentUser?.username || 'النظام'}
        </div>
      </div>

      {/* Receipt Title */}
      <div style={{ 
        textAlign: 'center', 
        marginBottom: '25px'
      }}>
        <h2 style={{ 
          fontSize: '24px', 
          margin: '0',
          color: '#1e40af',
          fontWeight: 'bold'
        }}>
          {type === 'send' ? '📤 إيصال إرسال حوالة' : '📥 إيصال استلام حوالة'}
        </h2>
      </div>

      {/* Transfer Code */}
      <div style={{ 
        backgroundColor: '#dbeafe',
        padding: '20px',
        borderRadius: '8px',
        marginBottom: '25px',
        textAlign: 'center',
        border: '2px solid #3b82f6'
      }}>
        <p style={{ 
          fontSize: '14px', 
          color: '#1e40af',
          margin: '0 0 8px 0',
          fontWeight: 'bold'
        }}>
          رقم الحوالة
        </p>
        <p style={{ 
          fontSize: '28px', 
          fontWeight: 'bold',
          color: '#1e3a8a',
          margin: 0,
          letterSpacing: '2px'
        }}>
          {transfer.code || transfer.transfer_code || '-'}
        </p>
      </div>

      {/* Transfer Details */}
      <div style={{ marginBottom: '25px' }}>
        <h3 style={{ 
          fontSize: '18px',
          borderBottom: '2px solid #e5e7eb',
          paddingBottom: '10px',
          marginBottom: '15px',
          color: '#1e40af',
          fontWeight: 'bold'
        }}>
          📋 تفاصيل الحوالة
        </h3>
        
        <table style={{ 
          width: '100%', 
          borderCollapse: 'collapse',
          fontSize: '15px'
        }}>
          <tbody>
            <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
              <td style={{ padding: '12px', fontWeight: 'bold', width: '35%', backgroundColor: '#f9fafb' }}>
                التاريخ:
              </td>
              <td style={{ padding: '12px' }}>
                {formatDate(transfer.created_at)}
              </td>
            </tr>
            <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
              <td style={{ padding: '12px', fontWeight: 'bold', backgroundColor: '#f9fafb' }}>
                المبلغ:
              </td>
              <td style={{ padding: '12px', fontSize: '18px', fontWeight: 'bold', color: '#059669' }}>
                {formatCurrency(transfer.amount, transfer.currency)}
              </td>
            </tr>
            {(transfer.outgoing_commission > 0 || transfer.incoming_commission > 0) && (
              <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
                <td style={{ padding: '12px', fontWeight: 'bold', backgroundColor: '#f9fafb' }}>
                  العمولة:
                </td>
                <td style={{ padding: '12px', color: '#dc2626' }}>
                  {formatCurrency(transfer.outgoing_commission || transfer.incoming_commission, transfer.currency)}
                </td>
              </tr>
            )}
            <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
              <td style={{ padding: '12px', fontWeight: 'bold', backgroundColor: '#f9fafb' }}>
                الحالة:
              </td>
              <td style={{ padding: '12px' }}>
                <span style={{
                  padding: '4px 12px',
                  borderRadius: '4px',
                  backgroundColor: transfer.status === 'completed' ? '#d1fae5' : 
                                   transfer.status === 'pending' ? '#fef3c7' : '#fee2e2',
                  color: transfer.status === 'completed' ? '#065f46' : 
                         transfer.status === 'pending' ? '#92400e' : '#991b1b',
                  fontWeight: 'bold',
                  fontSize: '14px'
                }}>
                  {transfer.status === 'completed' ? '✅ مسلّمة' : 
                   transfer.status === 'pending' ? '⏳ قيد الانتظار' : '❌ ملغاة'}
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Sender/Receiver Information */}
      <div style={{ marginBottom: '25px' }}>
        <h3 style={{ 
          fontSize: '18px',
          borderBottom: '2px solid #e5e7eb',
          paddingBottom: '10px',
          marginBottom: '15px',
          color: '#1e40af',
          fontWeight: 'bold'
        }}>
          👥 معلومات الأطراف
        </h3>
        
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <tr>
            <td style={{ width: '50%', padding: '10px', verticalAlign: 'top' }}>
              <div style={{ 
                backgroundColor: '#fef3c7',
                padding: '15px',
                borderRadius: '8px',
                border: '1px solid #f59e0b'
              }}>
                <h4 style={{ 
                  fontSize: '15px',
                  margin: '0 0 12px 0',
                  color: '#92400e',
                  fontWeight: 'bold'
                }}>
                  📤 المرسل
                </h4>
                <p style={{ margin: '6px 0', fontSize: '14px' }}>
                  <strong>الاسم:</strong> {transfer.sender_name || '-'}
                </p>
                <p style={{ margin: '6px 0', fontSize: '14px' }}>
                  <strong>الهاتف:</strong> {transfer.sender_phone || '-'}
                </p>
                <p style={{ margin: '6px 0', fontSize: '14px' }}>
                  <strong>الموقع:</strong> {transfer.from_governorate || '-'}
                </p>
              </div>
            </td>
            
            <td style={{ width: '50%', padding: '10px', verticalAlign: 'top' }}>
              <div style={{ 
                backgroundColor: '#d1fae5',
                padding: '15px',
                borderRadius: '8px',
                border: '1px solid #10b981'
              }}>
                <h4 style={{ 
                  fontSize: '15px',
                  margin: '0 0 12px 0',
                  color: '#065f46',
                  fontWeight: 'bold'
                }}>
                  📥 المستلم
                </h4>
                <p style={{ margin: '6px 0', fontSize: '14px' }}>
                  <strong>الاسم:</strong> {transfer.receiver_name || '-'}
                </p>
                <p style={{ margin: '6px 0', fontSize: '14px' }}>
                  <strong>الهاتف:</strong> {transfer.receiver_phone || '-'}
                </p>
                <p style={{ margin: '6px 0', fontSize: '14px' }}>
                  <strong>الموقع:</strong> {transfer.to_governorate || '-'}
                </p>
              </div>
            </td>
          </tr>
        </table>
      </div>

      {/* Agent Info */}
      {agentInfo && (
        <div style={{ 
          backgroundColor: '#ede9fe',
          padding: '15px',
          borderRadius: '8px',
          marginBottom: '25px',
          border: '1px solid #a78bfa'
        }}>
          <h4 style={{ 
            fontSize: '15px',
            margin: '0 0 12px 0',
            color: '#5b21b6',
            fontWeight: 'bold'
          }}>
            🏢 معلومات الصراف
          </h4>
          <p style={{ margin: '6px 0', fontSize: '14px' }}>
            <strong>الاسم:</strong> {agentInfo.display_name || '-'}
          </p>
          <p style={{ margin: '6px 0', fontSize: '14px' }}>
            <strong>الموقع:</strong> {agentInfo.governorate || '-'}
          </p>
          {agentInfo.phone_number && (
            <p style={{ margin: '6px 0', fontSize: '14px' }}>
              <strong>الهاتف:</strong> {agentInfo.phone_number}
            </p>
          )}
        </div>
      )}

      {/* Notes */}
      {transfer.notes && (
        <div style={{ marginBottom: '25px' }}>
          <h3 style={{ 
            fontSize: '18px',
            borderBottom: '2px solid #e5e7eb',
            paddingBottom: '10px',
            marginBottom: '15px',
            color: '#1e40af',
            fontWeight: 'bold'
          }}>
            📝 ملاحظات
          </h3>
          <p style={{ 
            padding: '12px',
            backgroundColor: '#f3f4f6',
            borderRadius: '8px',
            fontSize: '14px',
            lineHeight: '1.6',
            margin: 0
          }}>
            {transfer.notes}
          </p>
        </div>
      )}

      {/* Footer */}
      <div style={{ 
        marginTop: '40px',
        paddingTop: '20px',
        borderTop: '3px solid #2563eb',
        textAlign: 'center'
      }}>
        <p style={{ 
          fontSize: '13px',
          color: '#64748b',
          margin: '0 0 8px 0'
        }}>
          هذا الإيصال صادر إلكترونياً ولا يحتاج إلى ختم أو توقيع
        </p>
        <p style={{ 
          fontSize: '14px',
          color: '#1e40af',
          fontWeight: 'bold',
          margin: '8px 0'
        }}>
          تمت الطباعة بواسطة نظام الحوالات
        </p>
        <p style={{ 
          fontSize: '11px',
          color: '#94a3b8',
          margin: 0
        }}>
          © {new Date().getFullYear()} جميع الحقوق محفوظة
        </p>
      </div>
    </div>
  );
};

export default TransferReceipt;
