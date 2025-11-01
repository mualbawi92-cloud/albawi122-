import React from 'react';

/**
 * TransferReceipt Component
 * Printable receipt for transfer transactions
 */
const TransferReceipt = ({ transfer, agentInfo, type = 'send' }) => {
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

  return (
    <div style={{ 
      fontFamily: 'Arial, sans-serif',
      direction: 'rtl',
      padding: '40px',
      maxWidth: '800px',
      margin: '0 auto',
      backgroundColor: '#ffffff'
    }}>
      {/* Header */}
      <div style={{ 
        textAlign: 'center', 
        borderBottom: '3px solid #2563eb',
        paddingBottom: '20px',
        marginBottom: '30px'
      }}>
        <h1 style={{ 
          fontSize: '32px', 
          margin: '0 0 10px 0',
          color: '#1e40af'
        }}>
          {type === 'send' ? '📤 إيصال إرسال حوالة' : '📥 إيصال استلام حوالة'}
        </h1>
        <p style={{ 
          fontSize: '18px', 
          color: '#64748b',
          margin: 0
        }}>
          نظام إدارة الحوالات المالية
        </p>
      </div>

      {/* Transfer Code */}
      <div style={{ 
        backgroundColor: '#dbeafe',
        padding: '20px',
        borderRadius: '8px',
        marginBottom: '30px',
        textAlign: 'center'
      }}>
        <p style={{ 
          fontSize: '16px', 
          color: '#1e40af',
          margin: '0 0 8px 0',
          fontWeight: 'bold'
        }}>
          رقم الحوالة
        </p>
        <p style={{ 
          fontSize: '32px', 
          fontWeight: 'bold',
          color: '#1e3a8a',
          margin: 0,
          letterSpacing: '2px'
        }}>
          {transfer.code || '-'}
        </p>
      </div>

      {/* Transfer Details */}
      <div style={{ marginBottom: '30px' }}>
        <h2 style={{ 
          fontSize: '20px',
          borderBottom: '2px solid #e5e7eb',
          paddingBottom: '10px',
          marginBottom: '20px',
          color: '#1e40af'
        }}>
          📋 تفاصيل الحوالة
        </h2>
        
        <table style={{ 
          width: '100%', 
          borderCollapse: 'collapse',
          fontSize: '16px'
        }}>
          <tbody>
            <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
              <td style={{ padding: '12px', fontWeight: 'bold', width: '40%' }}>
                التاريخ:
              </td>
              <td style={{ padding: '12px' }}>
                {formatDate(transfer.created_at)}
              </td>
            </tr>
            <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
              <td style={{ padding: '12px', fontWeight: 'bold' }}>
                المبلغ:
              </td>
              <td style={{ padding: '12px', fontSize: '20px', fontWeight: 'bold', color: '#059669' }}>
                {formatCurrency(transfer.amount, transfer.currency)}
              </td>
            </tr>
            <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
              <td style={{ padding: '12px', fontWeight: 'bold' }}>
                العملة:
              </td>
              <td style={{ padding: '12px' }}>
                {transfer.currency}
              </td>
            </tr>
            {transfer.outgoing_commission > 0 && (
              <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
                <td style={{ padding: '12px', fontWeight: 'bold' }}>
                  العمولة (صادرة):
                </td>
                <td style={{ padding: '12px', color: '#dc2626' }}>
                  {formatCurrency(transfer.outgoing_commission, transfer.currency)}
                </td>
              </tr>
            )}
            {transfer.incoming_commission > 0 && (
              <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
                <td style={{ padding: '12px', fontWeight: 'bold' }}>
                  العمولة (واردة):
                </td>
                <td style={{ padding: '12px', color: '#dc2626' }}>
                  {formatCurrency(transfer.incoming_commission, transfer.currency)}
                </td>
              </tr>
            )}
            <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
              <td style={{ padding: '12px', fontWeight: 'bold' }}>
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
                  fontWeight: 'bold'
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
      <div style={{ marginBottom: '30px' }}>
        <h2 style={{ 
          fontSize: '20px',
          borderBottom: '2px solid #e5e7eb',
          paddingBottom: '10px',
          marginBottom: '20px',
          color: '#1e40af'
        }}>
          👥 معلومات الأطراف
        </h2>
        
        <div style={{ display: 'flex', gap: '20px' }}>
          {/* Sender */}
          <div style={{ 
            flex: 1,
            backgroundColor: '#fef3c7',
            padding: '20px',
            borderRadius: '8px'
          }}>
            <h3 style={{ 
              fontSize: '16px',
              margin: '0 0 15px 0',
              color: '#92400e'
            }}>
              📤 المرسل
            </h3>
            <p style={{ margin: '8px 0' }}>
              <strong>الاسم:</strong> {transfer.sender_name || '-'}
            </p>
            <p style={{ margin: '8px 0' }}>
              <strong>الهاتف:</strong> {transfer.sender_phone || '-'}
            </p>
            <p style={{ margin: '8px 0' }}>
              <strong>الموقع:</strong> {transfer.from_governorate || '-'}
            </p>
          </div>

          {/* Receiver */}
          <div style={{ 
            flex: 1,
            backgroundColor: '#d1fae5',
            padding: '20px',
            borderRadius: '8px'
          }}>
            <h3 style={{ 
              fontSize: '16px',
              margin: '0 0 15px 0',
              color: '#065f46'
            }}>
              📥 المستلم
            </h3>
            <p style={{ margin: '8px 0' }}>
              <strong>الاسم:</strong> {transfer.receiver_name || '-'}
            </p>
            <p style={{ margin: '8px 0' }}>
              <strong>الهاتف:</strong> {transfer.receiver_phone || '-'}
            </p>
            <p style={{ margin: '8px 0' }}>
              <strong>الموقع:</strong> {transfer.to_governorate || '-'}
            </p>
          </div>
        </div>
      </div>

      {/* Agent Info */}
      {agentInfo && (
        <div style={{ 
          backgroundColor: '#ede9fe',
          padding: '20px',
          borderRadius: '8px',
          marginBottom: '30px'
        }}>
          <h3 style={{ 
            fontSize: '16px',
            margin: '0 0 15px 0',
            color: '#5b21b6'
          }}>
            🏢 معلومات الصراف
          </h3>
          <p style={{ margin: '8px 0' }}>
            <strong>الاسم:</strong> {agentInfo.display_name || '-'}
          </p>
          <p style={{ margin: '8px 0' }}>
            <strong>الموقع:</strong> {agentInfo.governorate || '-'}
          </p>
          <p style={{ margin: '8px 0' }}>
            <strong>الهاتف:</strong> {agentInfo.phone_number || '-'}
          </p>
        </div>
      )}

      {/* Notes */}
      {transfer.notes && (
        <div style={{ marginBottom: '30px' }}>
          <h2 style={{ 
            fontSize: '20px',
            borderBottom: '2px solid #e5e7eb',
            paddingBottom: '10px',
            marginBottom: '20px',
            color: '#1e40af'
          }}>
            📝 ملاحظات
          </h2>
          <p style={{ 
            padding: '15px',
            backgroundColor: '#f3f4f6',
            borderRadius: '8px',
            fontSize: '16px',
            lineHeight: '1.6'
          }}>
            {transfer.notes}
          </p>
        </div>
      )}

      {/* Footer */}
      <div style={{ 
        marginTop: '50px',
        paddingTop: '20px',
        borderTop: '2px solid #e5e7eb',
        textAlign: 'center'
      }}>
        <p style={{ 
          fontSize: '14px',
          color: '#64748b',
          margin: '0 0 10px 0'
        }}>
          هذا الإيصال صادر إلكترونياً ولا يحتاج إلى ختم أو توقيع
        </p>
        <p style={{ 
          fontSize: '14px',
          color: '#64748b',
          margin: 0
        }}>
          تاريخ الطباعة: {new Date().toLocaleString('ar-IQ')}
        </p>
        <p style={{ 
          fontSize: '12px',
          color: '#94a3b8',
          marginTop: '20px'
        }}>
          نظام إدارة الحوالات المالية © {new Date().getFullYear()}
        </p>
      </div>
    </div>
  );
};

export default TransferReceipt;
