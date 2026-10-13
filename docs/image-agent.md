# Nexora AI — Image Agent

## Purpose

The image agent converts user requests into image-generation prompts,
invokes the configured image-generation provider, and returns the
generated image or a useful error message.

## Image quality

Prompts should preserve the user's original intent while adding relevant
visual details, including:

- Main subject, setting, and intended use
- Composition, framing, and perspective
- Lighting, shadows, and color palette
- Materials, textures, and environmental details
- Photographic style and camera characteristics when appropriate

Do not add unrelated subjects or details that change the user's request.
Use negative prompts only when the selected provider supports them.

## Reliability

- Validate that the user supplied a meaningful prompt.
- Apply provider-supported request options and timeouts.
- Handle rate limits, invalid credentials, and provider failures gracefully.
- Avoid logging API keys, credentials, or sensitive request data.
- Return a clear error when image generation fails.
- Preserve the existing image URL and storage integration contracts.

## Configuration

Configure the image provider's credentials and settings through the
environment variables expected by the current implementation.

Do not commit real credentials or production environment files to Git.
Use the provider's official documentation to verify supported models,
parameters, image sizes, and negative-prompt behavior.

## Testing

Run the image prompt enhancer tests from the repository root:

```bash
npm test --prefix backend/services/agent
```

Also verify image generation against the configured provider and confirm
that generated images can be displayed and, where enabled, uploaded to S3.

## Deployment

Deploy through the repository's established deployment workflow after
tests pass. Verify the existing EC2 deployment target and required GitHub
Actions secrets before triggering a production deployment.

Check agent logs and test image generation after deployment. Never print
secrets in logs or commit them to the repository.
