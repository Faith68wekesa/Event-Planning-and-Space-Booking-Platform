
from pathlib import Path

path = Path("frontend/src/components/ProviderAvailabilityDashboard.tsx")
source = path.read_text(encoding="utf-8")
original = source

def remove_between(text, start, end, description):
    if start not in text or end not in text:
        raise SystemExit(f"ERROR: Could not locate {description}. No changes saved.")
    before, remainder = text.split(start, 1)
    _, after = remainder.split(end, 1)
    return before + after

# Remove the Mark as Booked button.
source = remove_between(
    source,
    '                <button\n                  type="button"\n                  onClick={() => setDayStatus(selectedDayForEdit, \'BOOKED\')}',
    '                </button>\n\n                <button\n                  type="button"\n                  onClick={() => setDayStatus(selectedDayForEdit, \'UNAVAILABLE\')}',
    "Mark as Booked button"
)
# Restore the opening of the Unavailable button removed as an end marker.
source = source.replace(
    "                <button\n                  type=\"button\"\n                  onClick={() => setDayStatus(selectedDayForEdit, 'UNAVAILABLE')}",
    "                <button\n                  type=\"button\"\n                  onClick={() => setDayStatus(selectedDayForEdit, 'UNAVAILABLE')}",
    1
)

# Remove the Manage Availability button, preserving its containing layout.
source = remove_between(
    source,
    '            <button\n              type="button"\n              onClick={() => {\n                if (selectedDayForEdit === null) {',
    '            </button>\n          </div>',
    "Manage Availability button"
)
source = source.replace(
    '          <div style={{ display: \'flex\', justifyContent: \'space-between\', alignItems: \'center\' }}>\n\n          </div>',
    '',
    1
)

# Remove the Staff On Duty card, keeping the buffer card.
source = remove_between(
    source,
    '            <div style={{ padding: \'12px\', background: \'#f8fafc\', borderRadius: \'10px\', border: \'1px solid #e2e8f0\' }}>\n              <span style={{ display: \'block\', fontSize: \'0.82rem\', fontWeight: 700, color: \'#1e293b\', marginBottom: \'6px\' }}>Staff On Duty</span>',
    '            <div style={{ padding: \'12px\', background: \'#f8fafc\', borderRadius: \'10px\', border: \'1px solid #e2e8f0\' }}>\n              <span style={{ display: \'block\', fontSize: \'0.82rem\', fontWeight: 700, color: \'#1e293b\', marginBottom: \'6px\' }}>Setup / Travel Buffer</span>',
    "Staff On Duty card"
)

# Use the full width for the remaining buffer setting.
source = source.replace(
    '<div style={{ display: \'grid\', gridTemplateColumns: \'1fr 1fr\', gap: \'12px\' }}>',
    '<div style={{ display: \'grid\', gridTemplateColumns: \'1fr\', gap: \'12px\' }}>',
    1
)

# Replace the illustrative example with an accurate explanation.
old_example = """                💡 <strong>How this works:</strong> If you can serve <strong>{maxGuests} guests</strong> in total, and one customer books an event for <strong>70 guests</strong>, the platform automatically knows you still have capacity for <strong>{Math.max(0, maxGuests - 70)} more guests</strong> on that same day."""
new_example = """                <strong>How this works:</strong> This is your maximum total guest capacity for a single day. Booking validation uses this limit when checking whether you can accommodate a new booking."""
if old_example not in source:
    raise SystemExit("ERROR: Could not find the guest capacity example. No changes saved.")
source = source.replace(old_example, new_example, 1)

# Add a loading message above the capacity settings.
capacity_marker = '        {/* Capacity & Resources Card */}'
if capacity_marker not in source:
    raise SystemExit("ERROR: Could not find the capacity card.")
source = source.replace(
    capacity_marker,
    """        {isLoading && (
          <p style={{ color: '#64748b', fontSize: '0.85rem' }}>
            Loading your saved availability settings...
          </p>
        )}

        {/* Capacity & Resources Card */}""",
    1
)

# Prevent saving until loading is complete, and show the real save state.
source = source.replace(
    '            onClick={handleSaveChanges}\n            className="btn-primary-light"',
    '            onClick={handleSaveChanges}\n            disabled={isLoading || isSaving}\n            className="btn-primary-light"',
    1
)
source = source.replace(
    '              cursor: \'pointer\',\n              marginTop: \'auto\',',
    '              cursor: isLoading || isSaving ? \'not-allowed\' : \'pointer\',\n              opacity: isLoading || isSaving ? 0.6 : 1,\n              marginTop: \'auto\',',
    1
)
source = source.replace(
    '            <Save size={18} /> Save Changes',
    "            <Save size={18} /> {isSaving ? 'Saving...' : isLoading ? 'Loading...' : 'Save Changes'}",
    1
)

# Ensure all obsolete references have been removed.
for forbidden in ["setStaffOnDuty", "staffOnDuty", "Mark as Booked", "Manage Availability", "70 guests", "localStorage"]:
    if forbidden in source:
        raise SystemExit(f"ERROR: Obsolete reference remains: {forbidden}. No changes saved.")

if source == original:
    raise SystemExit("ERROR: No changes were made.")

path.write_text(source, encoding="utf-8")
print("Availability interface updated successfully.")
print("Original backup remains available.")
print("Staff On Duty, Mark as Booked, Manage Availability and mock example removed.")
