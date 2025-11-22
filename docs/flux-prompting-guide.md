# FLUX Prompting Guide for Doom Index

This document summarizes key FLUX prompting principles used in the Doom Index prompt generation system.

## FLUX Prompt Framework

FLUX uses a structured framework for optimal results:

**Subject + Action + Style + Context**

### Priority Order

1. Main subject → Key action → Critical style → Essential context → Secondary details
2. Word order matters: FLUX pays more attention to what comes first
3. Front-load your most important elements

### Enhancement Layers

Build beyond the basic framework with optional layers:

- **Foundation**: Subject + Action + Style + Context
- **Visual Layer**: Specific lighting, color palette, composition details
- **Technical Layer**: Camera settings, lens specs, quality markers
- **Atmospheric Layer**: Mood, emotional tone, narrative elements

## Context-Focused Prompts (for landscapes)

For landscapes and architectural shots, lead with the setting:

**Setting → Atmospheric conditions → Style → Technical specs**

Example progression:

- Foundation: "Ancient Greek temple ruins"
- - Atmosphere: "Ancient Greek temple ruins at sunset, golden hour lighting"
- - Style: "Ancient Greek temple ruins at sunset, golden hour lighting, cinematic photography style"
- - Details: "Ancient Greek temple ruins at sunset, golden hour lighting, cinematic photography style, with scattered marble columns"

## Positive Framing

Avoid negative prompts. Use positive alternatives instead:

- Instead of "no crowds" → "peaceful solitude"
- Instead of "without glasses" → "clear, unobstructed eyes"
- Ask: "If this thing wasn't there, what would I see instead?"

## Image-to-Image (i2i) Guidelines

When using reference images (token logos):

1. **Be explicit about maintaining style**: "Change to daytime while maintaining the same style of the painting"
2. **Use comprehensive prompts**: For complex edits, add as many details as possible
3. **Name specific styles**: Instead of vague terms, specify exactly what style you want
4. **Preserve what matters**: Explicitly state what elements shouldn't change

Example i2i prompt structure:

- Specify what to change
- Specify what to maintain (style, composition, etc.)
- Add details about the desired outcome

## Optimal Prompt Length

- **Short (10-30 words)**: Quick concepts and style exploration
- **Medium (30-80 words)**: Usually ideal for most projects
- **Long (80+ words)**: Complex scenes requiring detailed specifications

## References

- [FLUX Prompting Summary](https://docs.bfl.ai/guides/prompting_summary)
- [FLUX Image-to-Image Guide](https://docs.bfl.ai/guides/prompting_guide_kontext_i2i)
