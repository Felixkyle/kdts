<?php
/**
 * KADIS Digitals — Universal Form Handler
 * -----------------------------------------------------------------
 * Point ANY form's action="" at this one file. It works for every
 * form on the site (Training Request, Request-a-Solution, Join Our
 * Team, and any future ones) — no separate script needed per form.
 *
 * SETUP (do this once):
 *   1. Upload this file to the ROOT of kadisdigitals.com (same folder
 *      as index.html), e.g. via File Manager or FTP.
 *   2. Nothing else to install — this uses PHP's built-in mail()
 *      function, which on this shared host is relayed through the
 *      same mail server that owns kadisdigitals.com, so it should
 *      pass SPF checks and land in your inbox reliably.
 *
 * PER-FORM SETUP (do this for each <form> on the site):
 *   - Set action="https://kadisdigitals.com/send-form.php"
 *   - Add a hidden field: <input type="hidden" name="category" value="Training Request">
 *     (use a different value per form: "Join Our Team", "Request a Solution", etc.)
 *   - Optional: <input type="hidden" name="_next" value="https://kadisdigitals.com/thank-you.html">
 *     — if present, visitors who submit via a plain (non-JS) form POST
 *     get redirected there after a successful send.
 *   - Optional spam trap: <input type="text" name="_gotcha" style="display:none">
 *     Leave it empty. If a bot fills it in, the submission is dropped
 *     silently (bot sees a normal "success").
 *
 * If your form submits via fetch() with "Accept: application/json"
 * (like the Training Request and Request-a-Solution forms already do),
 * this script replies with { "ok": true/false } automatically —
 * no changes needed to your existing JS success/error handling logic,
 * as long as it checks response.ok the way those scripts already do.
 */

// ---------------- CONFIGURATION ----------------
$to          = 'admin@kadisdigitals.com';   // where YOU read and send from
$fromAddress = 'admin@kadisdigitals.com';   // same mailbox, both jobs
$fromName    = 'KADIS Website';
$siteName    = 'KADIS Digitals';
$whatsapp    = 'https://wa.me/2348061379390';

// ---------------- REQUEST GUARDS ----------------
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    exit('Method not allowed');
}

// Honeypot: if a bot filled this hidden field, pretend success and stop.
if (!empty($_POST['_gotcha'])) {
    respond_success(trim($_POST['_next'] ?? ''), true);
}

// ---------------- GATHER FIELDS ----------------
$category = trim($_POST['_category'] ?? 'General Enquiry');
$redirect = trim($_POST['_next'] ?? '');
unset($_POST['_gotcha'], $_POST['_next'], $_POST['_category']);

$visitorEmail = find_field($_POST, ['email', 'email address', 'e mail', 'e mail address']);
$visitorName  = find_field($_POST, ['name', 'full name']);

// ---------------- BUILD NOTIFICATION BODY ----------------
$bodyLines = [];
foreach ($_POST as $key => $value) {
    if (is_array($value)) {
        $value = implode(', ', array_filter($value, 'strlen'));
    }
    $value = trim((string) $value);
    if ($value === '') continue;
    $label = ucwords(str_replace(['_', '-'], ' ', $key));
    $bodyLines[] = "{$label}: {$value}";
}
$body = "New \"{$category}\" submission from {$siteName}\n"
      . "Received: " . date('Y-m-d H:i:s') . "\n"
      . str_repeat('-', 40) . "\n"
      . implode("\n", $bodyLines) . "\n";

// ---------------- SEND NOTIFICATION TO YOU ----------------
$subject = "[{$category}] New submission — {$siteName}";

$headers   = [];
$headers[] = "From: {$fromName} <{$fromAddress}>";
if ($visitorEmail) {
    $headers[] = "Reply-To: {$visitorEmail}";
}
$headers[] = "Content-Type: text/plain; charset=UTF-8";
$headers[] = "MIME-Version: 1.0";

$sent = @mail($to, $subject, $body, implode("\r\n", $headers));

// ---------------- OPTIONAL AUTO-REPLY TO THE VISITOR ----------------
if ($sent && $visitorEmail && filter_var($visitorEmail, FILTER_VALIDATE_EMAIL)) {
    $ackSubject = "We've received your request — {$siteName}";
    $ackBody = "Hi" . ($visitorName ? " {$visitorName}" : '') . ",\n\n"
        . "Thanks for reaching out to {$siteName}. We've received your "
        . strtolower($category) . " and a member of our team will get back "
        . "to you shortly.\n\n"
        . "If it's urgent, you can also reach us directly on WhatsApp: {$whatsapp}\n\n"
        . "— {$siteName}";

    $ackHeaders   = [];
    $ackHeaders[] = "From: {$fromName} <{$fromAddress}>";
    $ackHeaders[] = "Content-Type: text/plain; charset=UTF-8";
    $ackHeaders[] = "MIME-Version: 1.0";

    @mail($visitorEmail, $ackSubject, $ackBody, implode("\r\n", $ackHeaders));
}

// ---------------- RESPOND ----------------
respond_success($redirect, $sent);

// =================================================================

function find_field(array $fields, array $possibleNames) {
    foreach ($fields as $key => $value) {
        if (is_array($value)) continue;
        $normalized = strtolower(str_replace(['_', '-'], ' ', $key));
        foreach ($possibleNames as $name) {
            if ($normalized === $name) {
                return trim((string) $value);
            }
        }
    }
    return null;
}

function respond_success($redirect, $sent = true) {
    $wantsJson = isset($_SERVER['HTTP_ACCEPT'])
        && strpos($_SERVER['HTTP_ACCEPT'], 'application/json') !== false;

    if ($wantsJson) {
        header('Content-Type: application/json');
        http_response_code($sent ? 200 : 500);
        echo json_encode(['ok' => (bool) $sent]);
        exit;
    }

    if ($sent && $redirect) {
        header("Location: {$redirect}");
        exit;
    }

    header('Content-Type: text/plain; charset=UTF-8');
    echo $sent
        ? 'Thank you — your submission has been received.'
        : 'Something went wrong sending your message. Please try WhatsApp instead.';
    exit;
}