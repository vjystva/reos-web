import {
  parseCsv,
  toCsv,
  escapeCsvCell,
  normalizeHeader,
  guessMapping,
} from "@/lib/csv";

describe("parseCsv", () => {
  test("headers + rows, trimmed", () => {
    const { headers, rows } = parseCsv("a, b ,c\n1,2,3\n4,5,6");
    expect(headers).toEqual(["a", "b", "c"]);
    expect(rows).toEqual([
      ["1", "2", "3"],
      ["4", "5", "6"],
    ]);
  });

  test("quoted field containing a comma", () => {
    const { rows } = parseCsv('name,note\nRahul,"Bengaluru, KA"');
    expect(rows[0]).toEqual(["Rahul", "Bengaluru, KA"]);
  });

  test("doubled quotes unescape to a single quote", () => {
    const { rows } = parseCsv('a\n"say ""hi"""');
    expect(rows[0]).toEqual(['say "hi"']);
  });

  test("newline inside a quoted field stays in the cell", () => {
    const { rows } = parseCsv('a,b\n"line1\nline2",x');
    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual(["line1\nline2", "x"]);
  });

  test("CRLF line endings", () => {
    const { headers, rows } = parseCsv("a,b\r\n1,2\r\n");
    expect(headers).toEqual(["a", "b"]);
    expect(rows).toEqual([["1", "2"]]);
  });

  test("UTF-8 BOM is stripped from the first header", () => {
    const { headers } = parseCsv("﻿first_name,phone\nA,1");
    expect(headers[0]).toBe("first_name");
  });

  test("short rows are padded to header width", () => {
    const { rows } = parseCsv("a,b,c\n1,2");
    expect(rows[0]).toEqual(["1", "2", ""]);
  });

  test("blank trailing lines are dropped", () => {
    const { rows } = parseCsv("a\n1\n\n");
    expect(rows).toEqual([["1"]]);
  });

  test("empty input yields empty headers and rows", () => {
    expect(parseCsv("")).toEqual({ headers: [], rows: [] });
    expect(parseCsv("   \n ")).toEqual({ headers: [], rows: [] });
  });

  test("header-only input yields no rows", () => {
    const { headers, rows } = parseCsv("first_name,phone");
    expect(headers).toEqual(["first_name", "phone"]);
    expect(rows).toEqual([]);
  });
});

describe("escapeCsvCell / toCsv", () => {
  test("plain cells are left alone", () => {
    expect(escapeCsvCell("Rahul")).toBe("Rahul");
  });

  test("cells with a comma, quote or newline are quoted", () => {
    expect(escapeCsvCell("a,b")).toBe('"a,b"');
    expect(escapeCsvCell('say "hi"')).toBe('"say ""hi"""');
    expect(escapeCsvCell("a\nb")).toBe('"a\nb"');
  });

  test("round-trips through parseCsv", () => {
    const headers = ["first_name", "note"];
    const rows = [["Rahul", 'Bengaluru, KA "north"']];
    const back = parseCsv(toCsv(headers, rows));
    expect(back.headers).toEqual(headers);
    expect(back.rows).toEqual(rows);
  });
});

describe("normalizeHeader", () => {
  test("strips case, spaces and punctuation", () => {
    expect(normalizeHeader(" Client E-Mail ")).toBe("clientemail");
    expect(normalizeHeader("first_name")).toBe("firstname");
  });
});

describe("guessMapping", () => {
  const targets = [
    { key: "first_name", aliases: ["given name"] },
    { key: "last_name", aliases: ["surname"] },
    { key: "phone", aliases: ["mobile"] },
    { key: "email" },
  ];

  test("exact match wins, case/punctuation insensitive", () => {
    const m = guessMapping(["First Name", "Sur-name", "Mobile", "E-Mail"], targets);
    expect(m).toEqual({
      first_name: "First Name",
      last_name: "Sur-name",
      phone: "Mobile",
      email: "E-Mail",
    });
  });

  test("falls back to substring match", () => {
    const m = guessMapping(["Customer Phone Number", "Email Address"], targets);
    expect(m.phone).toBe("Customer Phone Number");
    expect(m.email).toBe("Email Address");
  });

  test("unmatched targets map to empty string", () => {
    const m = guessMapping(["totally", "unrelated"], targets);
    expect(m.first_name).toBe("");
    expect(m.phone).toBe("");
  });

  test("a header is consumed by only one target", () => {
    const m = guessMapping(["name"], [{ key: "first_name", aliases: ["name"] }, { key: "last_name", aliases: ["name"] }]);
    expect(m.first_name).toBe("name");
    expect(m.last_name).toBe("");
  });

  test("empty header list yields all-empty mapping", () => {
    expect(guessMapping([], targets)).toEqual({
      first_name: "",
      last_name: "",
      phone: "",
      email: "",
    });
  });
});
