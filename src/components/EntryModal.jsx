import { useState, useEffect, useMemo } from 'react';
import PasswordGenerator from './PasswordGenerator';

// Map categories to internal type
const categoryToType = {
  passwords: 'credential',
  addresses: 'contact',
  paymentCards: 'creditCard',
  bankAccounts: 'bankAccount',
  driverLicenses: 'driverLicense',
};

const categoryFields = {
  credential: [
    { label: 'Name', name: 'name', type: 'text', required: true },
    { label: 'Username', name: 'username', type: 'text' },
    { label: 'URL', name: 'url', type: 'url', placeholder: 'https://example.com' },
    { label: 'Password', name: 'password', type: 'password' },
  ],
  contact: [
    // 👤 Identity
    { label: 'Full Name', name: 'name', type: 'text', required: true },
    { label: 'Company', name: 'company', type: 'text' },

    // 📞 Contact
    { label: 'Full Name', type: 'text' },
    { label: 'Phone', name: 'phone', type: 'text' },
    { label: 'Email', name: 'email', type: 'email' },

    // 🏠 Address
    { label: 'Address Line 1', name: 'addressLine1', type: 'text', required: true },
    { label: 'Address Line 2', name: 'addressLine2', type: 'text' },
    { label: 'City', name: 'city', type: 'text' },
    { label: 'State', name: 'state', type: 'text' },
    { label: 'ZIP Code', name: 'zip', type: 'text' },
    { label: 'Country', name: 'country', type: 'text' },

    // 📝 Extra
    { label: 'Notes', name: 'notes', type: 'text' },
  ],
  creditCard: [
    { label: 'Cardholder Name', name: 'name', type: 'text', required: true },
    { label: 'Card Number', name: 'cardNumber', type: 'text' },
    { label: 'Expiry Date', name: 'expiry', type: 'text', placeholder: 'MM/YY' },
    { label: 'CVV', name: 'cvv', type: 'password' },
  ],
  bankAccount: [
    { label: 'Account Holder', name: 'name', type: 'text', required: true },
    { label: 'Bank Name', name: 'bankName', type: 'text' },
    { label: 'Account Number', name: 'accountNumber', type: 'text' },
    { label: 'Routing Number', name: 'routingNumber', type: 'text' },
  ],
  driverLicense: [
    { label: 'Full Name', name: 'name', type: 'text', required: true },
    { label: 'License Number', name: 'licenseNumber', type: 'text' },
    { label: 'State', name: 'state', type: 'text' },
    { label: 'Expiration Date', name: 'expiry', type: 'text' },
    { label: 'Date of Birth', name: 'dob', type: 'text' },
  ],
};

export default function EntryModal({
  isOpen,
  entry,
  category,
  categoryType, // ✅ NEW
  onClose,
  onSave,
}) {
  const [formData, setFormData] = useState({});
  const [showGenerator, setShowGenerator] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // ✅ FIXED TYPE RESOLUTION
  const type = useMemo(() => {
    return entry?.type || categoryType || categoryToType[category] || 'credential';
  }, [entry, category, categoryType]);

  const fields = categoryFields[type] || [];

  // ✅ FIXED INITIALIZATION (NO CRASH)
  useEffect(() => {
    if (!isOpen) return;

    const initial = {};

    for (const f of fields) {
      initial[f.name] =
        entry?.data?.[f.name] ??   // ✅ NEW STRUCTURE
        entry?.[f.name] ??        // fallback for old data
        '';
    }

    setFormData(initial);
    setIsSubmitting(false);
  }, [isOpen, entry, fields]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (isSubmitting) return;
    setIsSubmitting(true);

    try {
      const base = entry
        ? { ...entry, ...formData }
        : { ...formData, type };

      const saveData = {
        ...base,
        title:
          base.title ||
          base.name ||
          base.addressLine ||
          base.bankName ||
          'Untitled Entry',
      };

      await onSave(saveData);
      onClose();
    } catch (err) {
      console.error('Save error:', err);
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* OVERLAY */}
      <div
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.75)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 99999,
        }}
        onClick={onClose}
      >
        {/* MODAL */}
        <div
          style={{
            background: '#0f3d24',
            padding: '2rem',
            borderRadius: '14px',
            width: '90%',
            maxWidth: '520px',
            color: '#fff',
            boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* HEADER */}
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <h2>
              {entry ? 'Edit Entry' : `Add ${category}`}
            </h2>

            <button onClick={onClose} style={{ fontSize: '1.2rem' }}>
              ×
            </button>
          </div>

          {/* FORM */}
          <form onSubmit={handleSubmit}>
            {fields.map((field) => (
              <label
                key={field.name}
                style={{ display: 'block', marginBottom: '10px' }}
              >
                <div style={{ fontSize: '12px', opacity: 0.7 }}>
                  {field.label}
                </div>

                <input
                  name={field.name}
                  value={formData[field.name] || ''}
                  onChange={handleChange}
                  type={field.type}
                  placeholder={field.placeholder || ''}
                  required={field.required || false}
                  style={{
                    width: '100%',
                    padding: '10px',
                    borderRadius: '6px',
                    marginTop: '4px',
                    border: '1px solid rgba(255,255,255,0.2)',
                    background: '#f1faf5',
                    color: '#1e3a2f',
                  }}
                />
              </label>
            ))}

            {/* PASSWORD GENERATOR */}
            {type === 'credential' && (
              <button
                type="button"
                onClick={() => setShowGenerator(true)}
                style={{ marginTop: '10px' }}
              >
                Generate Password
              </button>
            )}

            {/* ACTIONS */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                gap: '10px',
                marginTop: '20px',
              }}
            >
              <button type="button" onClick={onClose}>
                Cancel
              </button>

              <button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Saving...' : 'Save'}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* PASSWORD GENERATOR */}
      <PasswordGenerator
        isOpen={showGenerator}
        onClose={() => setShowGenerator(false)}
        onUsePassword={(p) =>
          setFormData((prev) => ({ ...prev, password: p }))
        }
      />
    </>
  );
}