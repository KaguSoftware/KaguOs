"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CreateForm } from "@/components/ui/create";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/input";
import { DatePicker } from "@/components/ui/date-picker";
import { MultiDropdown } from "@/components/ui/dropdown";
import { saveMeeting } from "@/lib/actions/comms";
import { todayInIstanbul } from "@/lib/utils";
import type { CommsMeeting } from "@/lib/types";

/**
 * Record or edit a meeting. One form for both — the only difference is a hidden
 * `id`, which the action reads to decide insert vs update.
 */
export function MeetingForm({
  members,
  meeting,
}: {
  members: { id: string; name: string }[];
  meeting?: CommsMeeting;
}) {
  const router = useRouter();
  // MultiDropdown is controlled and contributes nothing to FormData, so the
  // picked ids are mirrored into hidden inputs below.
  const [attendees, setAttendees] = useState<string[]>(meeting?.attendees ?? []);

  return (
    <CreateForm
      action={saveMeeting}
      fieldLabels={{ title: "Title" }}
      submitLabel={meeting ? "Save meeting" : "Record meeting"}
      onCancel={() => router.back()}
    >
      {meeting && <input type="hidden" name="id" value={meeting.id} />}

      <Field label="Title" htmlFor="m-title">
        <Input
          id="m-title"
          name="title"
          maxLength={200}
          defaultValue={meeting?.title ?? ""}
          autoFocus
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Held on" htmlFor="m-date">
          <DatePicker
            id="m-date"
            name="held_on"
            // Defaults to today in ISTANBUL, not UTC — before 03:00 local the
            // UTC date is still yesterday, which would silently misdate every
            // early-morning meeting.
            defaultValue={meeting?.held_on ?? todayInIstanbul()}
          />
        </Field>
        <Field label="Attendees" htmlFor="m-attendees">
          <MultiDropdown
            id="m-attendees"
            label="Attendees"
            values={attendees}
            onChange={setAttendees}
            placeholder="Nobody picked"
            summaryNoun="people"
            options={members.map((m) => ({ value: m.id, label: m.name }))}
          />
        </Field>
      </div>
      {attendees.map((id) => (
        <input key={id} type="hidden" name="attendees" value={id} />
      ))}

      <Field
        label="Summary"
        htmlFor="m-summary"
        hint="The one line someone should read without opening this."
      >
        <Input
          id="m-summary"
          name="summary"
          maxLength={300}
          defaultValue={meeting?.summary ?? ""}
        />
      </Field>

      <Field label="Notes" htmlFor="m-notes">
        <Textarea
          id="m-notes"
          name="notes"
          rows={8}
          defaultValue={meeting?.notes ?? ""}
        />
      </Field>
    </CreateForm>
  );
}
