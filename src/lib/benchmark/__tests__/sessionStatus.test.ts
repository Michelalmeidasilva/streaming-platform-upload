import { reconcileSession } from "../sessionStatus";

it("complete quando todos os tipos reportaram", () => {
  expect(
    reconcileSession({
      launchedTypes: ["c5.xlarge", "g6.xlarge"],
      reportedLabels: ["c5.xlarge", "g6.xlarge"],
      ageMinutes: 10,
    })
  ).toMatchObject({ status: "complete", reported: 2, total: 2 });
});

it("collecting quando parcial e dentro da janela", () => {
  expect(
    reconcileSession({
      launchedTypes: ["c5.xlarge", "g6.xlarge"],
      reportedLabels: ["c5.xlarge"],
      ageMinutes: 10,
    })
  ).toMatchObject({ status: "collecting", reported: 1, total: 2 });
});

it("incomplete quando parcial e passou da janela", () => {
  expect(
    reconcileSession({
      launchedTypes: ["c5.xlarge", "g6.xlarge"],
      reportedLabels: ["c5.xlarge"],
      ageMinutes: 200,
    })
  ).toMatchObject({ status: "incomplete", reported: 1, total: 2 });
});

it("launched quando nada reportou ainda e recente", () => {
  expect(
    reconcileSession({
      launchedTypes: ["c5.xlarge"],
      reportedLabels: [],
      ageMinutes: 1,
    })
  ).toMatchObject({ status: "launched", reported: 0, total: 1 });
});

// Edge cases
it("complete quando reportedLabels tem mais que launchedTypes (superset)", () => {
  expect(
    reconcileSession({
      launchedTypes: ["c5.xlarge"],
      reportedLabels: ["c5.xlarge", "extra.machine"],
      ageMinutes: 5,
    })
  ).toMatchObject({ status: "complete", reported: 1, total: 1 });
});

it("incomplete quando zero reportado e passou da janela", () => {
  expect(
    reconcileSession({
      launchedTypes: ["c5.xlarge", "g6.xlarge"],
      reportedLabels: [],
      ageMinutes: 121,
    })
  ).toMatchObject({ status: "incomplete", reported: 0, total: 2 });
});

it("launched exatamente no limite da janela (120 min)", () => {
  expect(
    reconcileSession({
      launchedTypes: ["c5.xlarge"],
      reportedLabels: [],
      ageMinutes: 120,
    })
  ).toMatchObject({ status: "launched", reported: 0, total: 1 });
});

it("incomplete logo acima do limite (121 min) com zero reportados", () => {
  expect(
    reconcileSession({
      launchedTypes: ["c5.xlarge"],
      reportedLabels: [],
      ageMinutes: 121,
    })
  ).toMatchObject({ status: "incomplete", reported: 0, total: 1 });
});
