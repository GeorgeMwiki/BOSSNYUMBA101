/**
 * XML fixtures — the shapes legacy LPMS products ship.
 */

export const XML_EXPORT = `<?xml version="1.0" encoding="UTF-8"?>
<export>
  <properties>
    <property>
      <id>P-001</id>
      <name>Sunset Heights</name>
      <address>123 Riverside Dr</address>
      <city>Nairobi</city>
      <unitCount>12</unitCount>
      <type>apartment_complex</type>
    </property>
    <property>
      <id>P-002</id>
      <name>Oak Ridge</name>
      <address>45 Oak Ln</address>
    </property>
  </properties>
  <units>
    <unit>
      <id>U-01</id>
      <propertyName>Sunset Heights</propertyName>
      <label>A1</label>
      <bedrooms>2</bedrooms>
      <rent>35000</rent>
    </unit>
  </units>
  <customers>
    <customer>
      <id>C-001</id>
      <name>Jane Mwangi</name>
      <phone>+254712345678</phone>
      <email>jane@example.com</email>
    </customer>
  </customers>
  <leases>
    <lease>
      <id>L-001</id>
      <customerName>Jane Mwangi</customerName>
      <unitLabel>A1</unitLabel>
      <propertyName>Sunset Heights</propertyName>
      <startDate>2024-01-01</startDate>
      <rent>35000</rent>
    </lease>
  </leases>
  <payments>
    <payment>
      <id>PAY-1</id>
      <customerName>Jane Mwangi</customerName>
      <amount>35000</amount>
      <date>2024-02-01</date>
      <method>mpesa</method>
    </payment>
  </payments>
</export>`;

/** Single-property XML (fast-xml-parser returns an object, not an array). */
export const XML_SINGLE_PROPERTY = `<?xml version="1.0"?>
<export>
  <properties>
    <property>
      <name>Solo Tower</name>
      <address>1 Solo St</address>
    </property>
  </properties>
</export>`;

/** Malformed XML — missing close tag. */
export const XML_MALFORMED = `<export><properties><property><name>Broken</property></export>`;

/** Uses vendor-specific tag names. */
export const XML_VENDOR_CUSTOM = `<?xml version="1.0"?>
<export>
  <properties>
    <property>
      <buildingCode>B-77</buildingCode>
      <buildingTitle>Acacia Towers</buildingTitle>
    </property>
  </properties>
</export>`;
