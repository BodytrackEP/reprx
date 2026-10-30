type ChipClient = {
  is_test: boolean;
  is_active: boolean;
  deleted_at: string | null;
  cliniko_patient_id: number | null;
  cliniko_archived_at: string | null;
};

const chip = "inline-block rounded-full px-2 py-0.5 text-xs font-medium";

export function ClientChips({ client }: { client: ChipClient }) {
  return (
    <span className="inline-flex flex-wrap gap-1.5 align-middle">
      {client.deleted_at && <span className={`${chip} bg-red-100 text-red-800`}>Deleted</span>}
      {!client.deleted_at && !client.is_active && (
        <span className={`${chip} bg-gray-100 text-gray-800`}>Inactive</span>
      )}
      {client.is_test ? (
        <span className={`${chip} bg-purple-100 text-purple-800`}>Test</span>
      ) : (
        client.cliniko_patient_id === null && (
          <span className={`${chip} bg-amber-50 text-amber-800`}>Not linked to Cliniko</span>
        )
      )}
      {client.cliniko_archived_at && (
        <span className={`${chip} bg-amber-100 text-amber-800`}>Archived in Cliniko</span>
      )}
    </span>
  );
}
