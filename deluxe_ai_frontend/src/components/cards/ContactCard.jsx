"use client";

import Card from "../common/Card";

export default function ContactCard({ contact }) {
  return (
    <Card>
      <h3
        className="
font-semibold
"
      >
        Contact Specialist
      </h3>

      <p
        className="
mt-2
text-sm
"
      >
        {contact.message}
      </p>

      {contact.missingFields?.length > 0 && (
        <div className="mt-3">
          <p className="text-sm font-medium">Required:</p>

          <ul
            className="
list-disc
pl-5
text-sm
"
          >
            {contact.missingFields.map((field) => (
              <li key={field}>{field}</li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}
