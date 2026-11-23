# automation-audit

Independent demo, not affiliated with Virtustant (cliente não diz).

A small command-line tool for the first step of an automation project: find out which manual tasks are worth automating first. You list the tasks in a CSV. It ranks them by hours saved per unit of effort.

I wrote it after reading a job post for an AI automation role that starts with "audit internal workflows and identify repetitive, manual, or inefficient processes." This is my guess at what that first pass could look like.

## How it works

Each task has a run count, minutes per run, an error rate, a complexity score from 1 to 5, and a flag for whether its data is structured (`yes`, `partly`, `no`).

- Hours per month = runs × minutes, plus rework. Each error costs three times a normal run.
- Effort = complexity, plus 1 if data is `partly` structured, plus 3 if it is `no`.
- Payoff = hours per month ÷ effort.

The report lists tasks by payoff, says how much of the total time the top three cover, and names tasks whose data should be cleaned up before any automation.

The weights (3× rework, the data penalty) are my own rough choices. Change them in `src/audit.mjs`.

## Run it

Needs Node 18 or newer. No dependencies.

```
node src/cli.mjs examples/sample-inventory.csv        # top 3
node src/cli.mjs examples/sample-inventory.csv 5      # top 5
npm test
```

`examples/sample-inventory.csv` is invented example data. It does not describe any real company.

## What was tested

- 11 offline tests with `node --test`, run in GitHub Actions on every push.
- CSV parsing, including comments, quoted commas, missing columns and out-of-range values.
- The hours, effort and payoff formulas, checked against numbers worked out by hand.
- Ranking order and tie-breaking, and the full report on the sample file.
- The command line on the sample file, and its failure without arguments.

## What was not tested

- Whether the ranking matches what real teams would pick. The weights are guesses and the sample data is made up.
- Large files, and CSV edge cases such as multi-line cells or unusual encodings.
- Windows. I only ran it on macOS and in GitHub's Linux runner.
- It does not read any live system. Inventory entries are typed by hand.
