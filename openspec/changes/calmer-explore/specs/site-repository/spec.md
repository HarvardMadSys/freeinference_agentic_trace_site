# Spec Delta

## Purpose

The pages are set in type large enough to read charts by.

## ADDED Requirements

### Requirement: Type size
The base type size SHALL be 18 px, and no text on any page, the charts'
tick labels and legends included, SHALL render under 14 px. Headings SHALL
keep their ratios to the base. The 360-pixel layout SHALL still fit without
horizontal scrolling.

#### Scenario: The smallest text
- **WHEN** any page is opened at desktop width
- **THEN** the computed size of every text element SHALL be at least 14 px

#### Scenario: A phone
- **WHEN** the Explore page is opened 360 pixels wide
- **THEN** the page SHALL not scroll sideways
