//! SMTP test sending via the `lettre` crate.
//!
//! Browsers cannot open raw SMTP sockets, so the actual send happens here in
//! the Rust backend. Two commands are exposed: `smtp_test` (verify the
//! connection/credentials) and `smtp_send` (send a single message). Bulk
//! sending is intentionally NOT implemented in the MVP.

use lettre::message::{header::ContentType, Mailbox, MultiPart, SinglePart};
use lettre::transport::smtp::authentication::Credentials;
use lettre::transport::smtp::client::{Tls, TlsParameters};
use lettre::{AsyncSmtpTransport, AsyncTransport, Message, Tokio1Executor};
use serde::Deserialize;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SmtpConfig {
    pub host: String,
    pub port: u16,
    pub username: String,
    pub password: String,
    pub sender_email: String,
    pub sender_name: String,
    /// "ssl_tls" | "starttls" | "none"
    pub encryption: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OutgoingEmail {
    pub to: String,
    pub from_name: String,
    pub from_email: String,
    pub subject: String,
    pub text: String,
    pub html: String,
}

fn build_transport(config: &SmtpConfig) -> Result<AsyncSmtpTransport<Tokio1Executor>, String> {
    let creds = Credentials::new(config.username.clone(), config.password.clone());

    let builder = match config.encryption.as_str() {
        "ssl_tls" => {
            let tls = TlsParameters::new(config.host.clone())
                .map_err(|e| format!("TLS setup failed: {e}"))?;
            AsyncSmtpTransport::<Tokio1Executor>::builder_dangerous(&config.host)
                .tls(Tls::Wrapper(tls))
        }
        "starttls" => {
            let tls = TlsParameters::new(config.host.clone())
                .map_err(|e| format!("TLS setup failed: {e}"))?;
            AsyncSmtpTransport::<Tokio1Executor>::builder_dangerous(&config.host)
                .tls(Tls::Required(tls))
        }
        _ => AsyncSmtpTransport::<Tokio1Executor>::builder_dangerous(&config.host),
    };

    Ok(builder.port(config.port).credentials(creds).build())
}

#[tauri::command]
pub async fn smtp_test(config: SmtpConfig) -> Result<(), String> {
    let transport = build_transport(&config)?;
    match transport.test_connection().await {
        Ok(true) => Ok(()),
        Ok(false) => Err("Server did not accept the connection.".into()),
        Err(e) => Err(format!("Connection failed: {e}")),
    }
}

#[tauri::command]
pub async fn smtp_send(config: SmtpConfig, email: OutgoingEmail) -> Result<(), String> {
    let from: Mailbox = format!("{} <{}>", email.from_name, email.from_email)
        .parse()
        .map_err(|_| "Invalid sender address".to_string())?;
    let to: Mailbox = email
        .to
        .parse()
        .map_err(|_| "Invalid recipient address".to_string())?;

    let message = Message::builder()
        .from(from)
        .to(to)
        .subject(email.subject)
        .multipart(
            MultiPart::alternative()
                .singlepart(
                    SinglePart::builder()
                        .header(ContentType::TEXT_PLAIN)
                        .body(email.text),
                )
                .singlepart(
                    SinglePart::builder()
                        .header(ContentType::TEXT_HTML)
                        .body(email.html),
                ),
        )
        .map_err(|e| format!("Failed to build message: {e}"))?;

    let transport = build_transport(&config)?;
    transport
        .send(message)
        .await
        .map_err(|e| format!("Send failed: {e}"))?;
    Ok(())
}
