---
title: Shared content without identical websites
date: 2026-10-09
category: technology-ai
summary: How shared content can support distinct websites, and which boundaries help keep facts consistent without forcing every page into the same layout.
description: Explore shared content architecture: consistent records, distinct website experiences and checks for changes that affect several sites.
image: /img/insights/introducing-the-new-fxnholdings-com.webp
image_alt: Illustration of a new website surrounded by cards representing shopping, travel, publishing, price comparison and online tool platforms
---

Running several websites creates a recurring design question: which information should be maintained once, and which decisions belong to each website? Copying everything creates repeated maintenance work. Sharing everything can make distinct services feel like variations of the same page.

FXN Holdings uses shared services for its content and comparison websites, while individual websites are built and deployed separately. Our [Technology & AI page](/technology/) describes that arrangement. Here we explore the practical boundaries behind this approach and the trade-offs a team should consider when designing something similar.

## Share facts that should agree

A shared content record is most useful when several websites need the same underlying information. Product identifiers, source references and verified specifications are candidates for reuse. If a factual correction applies everywhere, maintaining one record can make the correction easier to manage.

Presentation is a different concern. A comparison page may need a compact list of attributes, while an editorial page may need an explanation of why an attribute matters. Both can draw on the same information without displaying the same text in the same order.

Imagine a fictional travel accessory featured on a shopping site and in a packing guide. Its dimensions should agree across both. The shopping page might emphasise available offers; the guide might explain the space it occupies in a bag. Those are different reader questions, even though the item is the same.

Start by writing down which fields are authoritative and which fields each website can adapt. That boundary is easier to maintain when it is explicit.

## Give each website its own purpose

Sharing a back end does not remove the need for a clear audience and useful content on each website. The reason to create another page should come from what it helps a reader do, rather than simply from the availability of a reusable record.

A practical planning exercise is to describe the task each page supports:

- A comparison page helps a reader weigh relevant differences.
- A product page explains a particular item and its offer.
- A guide helps someone understand a problem or make a decision.

If two proposed pages have the same audience, facts and purpose, consider whether one useful page would serve readers better. A different logo or introduction is not much of a reason to maintain another version.

Our [portfolio](/portfolio/) spans different kinds of platforms. The useful architectural question is what each experience needs, not how to make every experience use every shared feature.

## Define a clear contract between content and pages

A website needs to know what a shared record means. Is a field required? Can it be empty? Does a missing value mean “unknown”, “not applicable” or “not yet supplied”? Treating those states as interchangeable can produce confusing output.

For a hypothetical offer record, an absent price should not silently become a zero price. An unavailable product image should not cause unrelated imagery to appear as if it depicts the item. Decide how each missing or invalid value should be displayed before it occurs in production.

Useful checks include validating required identifiers, preserving units alongside measurements, and distinguishing unpublished records from public ones. These are design recommendations rather than a list of controls we claim to have implemented on every FXN platform.

The same care applies when AI enriches a record. A generated description should not overwrite the evidence needed to check it. Our [AI publishing approach](/insights/how-we-use-ai/) keeps human review central to that decision.

## Separate releases, but recognise shared dependencies

Independent website deployments let teams release presentation changes separately. However, a shared content service is still a shared dependency. A change to its fields or behaviour can affect several consumers even if none of those websites receives a new deployment.

Before changing a shared field, identify the pages that consume it. Consider keeping the previous representation available while consumers are updated, and test more than the website that originally requested the change.

A useful test case includes incomplete data as well as the ideal record. Check a missing image, an unusually long title and a temporarily unavailable service. The goal is to understand what the reader sees when the input is imperfect.

Our published platform overview describes stored-content fallbacks for CMS-backed sites. Such a fallback can preserve access during a disruption, but the team still needs to consider whether older information remains appropriate for the page's purpose.

## Keep public addresses stable as systems change

A change to a CMS or page renderer should not automatically require a new public URL. Readers may have bookmarked the page, and other websites may link to it. Plan the public address separately from the internal location of its content.

The W3C's guidance on [stable web addresses](https://www.w3.org/Provider/Style/URI) explains why URLs should survive changes in implementation and organisation. In practice, keep an inventory of important public paths and check them during a migration. Where a move is necessary, plan how existing links will reach the replacement.

Shared content works best when common facts stay consistent and each website remains useful in its own right. The boundaries deserve as much attention as the shared infrastructure. If you are exploring a platform or partnership, [talk to our team](/contact/) about the audience and problem you want to serve.
