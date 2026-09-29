# Beetles & Butterflies Website — Editing Guide

## Where to edit common website content

The main website page is `index.html`. Open it in a text editor such as VS Code, CotEditor, Notepad++, or another HTML editor.

### Participant scrolling banner
The participant cards are in the `#journey` section of `index.html`.

For each participant, replace:
- the `src="reel-X.svg"` image with the participant's photo file; and
- the `data-comment="..."` text with the participant's approved comment.

Keep written/photo consent on file before publishing participant images or quotes.

### Programs
The three program cards are in the `#programs` section. You can edit the headings, descriptions, lists, and links directly there.

### Career Coaching
The third program card currently contains starter language for women navigating career change, reinvention, professional confidence, workforce readiness, and their next chapter. Replace or expand that paragraph as your coaching offer develops.

### Classroom Clip
Replace `classroom-clip.svg` with a real 60-second video thumbnail or image and update the `#classroom-clip` link when the video is hosted.

### Resources
The Resources visual is currently a placeholder area. Replace it with a real image, video thumbnail, or resource graphic when ready.

## Participant information and security

The website forms in this draft are **not yet connected to a secure submission service**. Do not publish the registration/contact forms as if submissions are being stored or emailed until an actual form backend is connected.

For launch, use a reputable form processor (for example, a secure form service or your Google Workspace/Google Forms account) and configure it to:
1. collect only information you actually need;
2. send notifications to the Beetles & Butterflies administrative email;
3. restrict access to submitted participant information;
4. use HTTPS;
5. provide a privacy notice and retention/deletion process; and
6. avoid placing sensitive participant information in URL parameters or unsecured email links.

The registration form can then be pointed to the secure form endpoint. The same approach should be used for the `Let's Connect` form.

## Cohort application
The current Cohort Pilot application link points to the Google Form supplied for the program application. The flyer image is included in the website package as `The-Beetles-Butterflies-COHORT-Application.png` for future use.

## Important
This is a static website package, not a full content-management system. If you want to edit photos, testimonials, programs, forms, and text yourself without editing HTML, ask the website developer to move the site into a CMS such as WordPress, Wix, Squarespace, Webflow, or another platform with an editor you control.
