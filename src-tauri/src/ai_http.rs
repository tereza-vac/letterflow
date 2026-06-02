use std::time::Duration;

#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AiHttpRequest {
    pub url: String,
    pub body: String,
    pub api_key: String,
}

#[derive(serde::Serialize)]
pub struct AiHttpResponse {
    pub status: u16,
    pub body: String,
}

/// POST to an AI provider with a generous timeout (email generation can take >30s).
#[tauri::command]
pub async fn ai_http_post(req: AiHttpRequest) -> Result<AiHttpResponse, String> {
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(120))
        .connect_timeout(Duration::from_secs(30))
        .build()
        .map_err(|e| e.to_string())?;

    let res = client
        .post(&req.url)
        .header("Authorization", format!("Bearer {}", req.api_key))
        .header("Content-Type", "application/json")
        .body(req.body)
        .send()
        .await
        .map_err(format_network_error)?;

    let status = res.status().as_u16();
    let body = res.text().await.map_err(|e| e.to_string())?;
    Ok(AiHttpResponse { status, body })
}

fn format_network_error(e: reqwest::Error) -> String {
    if e.is_timeout() {
        "AI request timed out after 120 seconds. Try a faster model (e.g. gemini-2.5-flash) or shorten the brief.".into()
    } else if e.is_connect() {
        format!("Could not connect to the AI API. Check Settings → Base URL and your internet connection. ({e})")
    } else {
        format!("Network error calling the AI API: {e}")
    }
}
