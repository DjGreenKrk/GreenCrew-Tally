#include "SetupPage.h"

#include <ctype.h>
#include <stdio.h>
#include <string.h>

namespace gctally {

namespace {

struct Texts {
    const char* lang;
    const char* title;
    const char* device;
    const char* recovery;
    const char* trialFailed;
    const char* notFound;
    const char* wrongPassword;
    const char* noIp;
    const char* noConnection;
    const char* unchanged;
    const char* networks;
    const char* rescan;
    const char* noNetworks;
    const char* ssid;
    const char* password;
    const char* passwordKeep;
    const char* passwordNone;
    const char* openNetwork;
    const char* name;
    const char* hubIp;
    const char* hubIpHint;
    const char* hubPort;
    const char* hubId;
    const char* hubIdHint;
    const char* mode;
    const char* modeWifi;
    const char* save;
    const char* restart;
    const char* paired;
    const char* unpair;
    const char* unpairHint;
    const char* saved;
    const char* savedNext;
    const char* errors[10];
};

const Texts english = {
    "en",
    "GC Tally setup",
    "Device",
    "The tally cannot reach its Wi-Fi network. It keeps trying and keeps its settings; you can change them here.",
    "Could not connect to",
    "network not found (the ESP8266 sees 2.4 GHz networks only)",
    "wrong password (WPA3-only networks do not work)",
    "no IP address from DHCP",
    "no connection",
    "The stored settings were not changed.",
    "Networks nearby",
    "Scan again",
    "No networks found.",
    "Wi-Fi network (SSID)",
    "Wi-Fi password",
    "Leave empty to keep the stored password.",
    "No password stored yet.",
    "Network without a password",
    "Tally name",
    "Hub address (IP)",
    "Leave empty to find the Hub automatically (mDNS). Enter it on networks that block multicast.",
    "Hub port",
    "Hub ID",
    "Optional. With several Hubs on the network: the ID shown on the Hub's Configuration page.",
    "Communication",
    "Wi-Fi + UDP (ESP-NOW in a later version)",
    "Save and connect",
    "Restart without changes",
    "Paired with Hub",
    "Unpair",
    "For a tally whose Hub is gone: afterwards any Hub can pair it again. The crew password set by the Hub is removed too.",
    "Saved. The tally restarts and connects to",
    "If it does not get a connection within 40 seconds, it comes back to this access point and shows what went wrong. The stored settings change only after a working connection.",
    {
        "",
        "Enter the Wi-Fi network.",
        "The network name may have at most 32 characters and no spaces at the start or end.",
        "The password needs 8 to 63 characters.",
        "The password may not start or end with a space.",
        "Enter the tally name.",
        "The tally name may have at most 26 characters, no \" and no spaces at the start or end.",
        "The Hub address may contain letters, digits, dots and dashes only.",
        "The Hub port must be a number from 1 to 65535.",
        "The Hub ID has 8 characters: digits and the letters a to f.",
    },
};

const Texts polish = {
    "pl",
    "GC Tally – konfiguracja",
    "Urządzenie",
    "Lampka nie może połączyć się ze swoją siecią Wi-Fi. Nadal próbuje i zachowuje ustawienia; tutaj możesz je zmienić.",
    "Nie udało się połączyć z siecią",
    "nie znaleziono sieci (ESP8266 widzi tylko sieci 2,4 GHz)",
    "błędne hasło (sieci tylko z WPA3 nie działają)",
    "brak adresu IP z DHCP",
    "brak połączenia",
    "Zapisane ustawienia nie zostały zmienione.",
    "Sieci w pobliżu",
    "Szukaj ponownie",
    "Nie znaleziono sieci.",
    "Sieć Wi-Fi (SSID)",
    "Hasło Wi-Fi",
    "Puste pole zachowuje zapisane hasło.",
    "Brak zapisanego hasła.",
    "Sieć bez hasła",
    "Nazwa lampki",
    "Adres Huba (IP)",
    "Puste pole: lampka sama znajdzie Hub (mDNS). Wpisz adres w sieciach, które blokują multicast.",
    "Port Huba",
    "ID Huba",
    "Opcjonalne. Gdy w sieci jest kilka Hubów: ID widoczne na stronie Konfiguracja w Hubie.",
    "Komunikacja",
    "Wi-Fi + UDP (ESP-NOW w późniejszej wersji)",
    "Zapisz i połącz",
    "Uruchom ponownie bez zmian",
    "Sparowana z Hubem",
    "Odparuj",
    "Dla lampki, której Hub zniknął: potem każdy Hub może ją sparować ponownie. Hasło ekipy ustawione przez Hub też zostanie usunięte.",
    "Zapisano. Lampka uruchamia się ponownie i łączy z siecią",
    "Jeśli w ciągu 40 sekund nie uzyska połączenia, wróci do tego punktu dostępu i pokaże, co poszło nie tak. Zapisane ustawienia zmieniają się dopiero po udanym połączeniu.",
    {
        "",
        "Podaj sieć Wi-Fi.",
        "Nazwa sieci może mieć najwyżej 32 znaki, bez spacji na początku i końcu.",
        "Hasło musi mieć od 8 do 63 znaków.",
        "Hasło nie może zaczynać się ani kończyć spacją.",
        "Podaj nazwę lampki.",
        "Nazwa lampki może mieć najwyżej 26 znaków, bez \" i bez spacji na początku i końcu.",
        "Adres Huba może zawierać tylko litery, cyfry, kropki i myślniki.",
        "Port Huba musi być liczbą od 1 do 65535.",
        "ID Huba ma 8 znaków: cyfry i litery od a do f.",
    },
};

const Texts& textsFor(Language language) { return language == Language::pl ? polish : english; }

const char* style =
    "<style>body{font-family:system-ui,sans-serif;max-width:32em;margin:auto;padding:1em;line-height:1.4}"
    "label{display:block;margin-top:1em;font-weight:600}input,select{width:100%;box-sizing:border-box;padding:.5em;font-size:1em}"
    "input[type=checkbox]{width:auto}.check{font-weight:400}.hint{color:#555;font-size:.9em;margin:.2em 0}"
    ".error{background:#fde8e8;border-left:4px solid #c00;padding:.6em}.note{background:#eef;padding:.6em}"
    ".nets button{display:block;width:100%;text-align:left;margin:.2em 0;padding:.5em;font-size:1em}"
    "button.main{margin-top:1.5em;width:100%;padding:.8em;font-size:1.1em}</style>";

void writeHead(TextSink& sink, const Texts& texts) {
    sink.write("<!DOCTYPE html><html lang=\"");
    sink.write(texts.lang);
    sink.write("\"><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><title>");
    sink.write(texts.title);
    sink.write("</title>");
    sink.write(style);
    sink.write("</head><body><h1>");
    sink.write(texts.title);
    sink.write("</h1>");
}

void writeInput(TextSink& sink, const char* label, const char* attributes, const char* value) {
    sink.write("<label>");
    sink.write(label);
    sink.write("<input ");
    sink.write(attributes);
    sink.write(" value=\"");
    writeEscaped(sink, value);
    sink.write("\"></label>");
}

void writeHint(TextSink& sink, const char* text) {
    sink.write("<p class=\"hint\">");
    sink.write(text);
    sink.write("</p>");
}

const char* failureText(const Texts& texts, WifiFailure failure) {
    switch (failure) {
        case WifiFailure::networkNotFound:
            return texts.notFound;
        case WifiFailure::wrongPassword:
            return texts.wrongPassword;
        case WifiFailure::noIp:
            return texts.noIp;
        default:
            return texts.noConnection;
    }
}

}  // namespace

Language pickLanguage(const char* acceptLanguage) {
    // The first language the browser lists wins.
    while (*acceptLanguage == ' ') acceptLanguage++;
    if (tolower(static_cast<unsigned char>(acceptLanguage[0])) == 'p' && tolower(static_cast<unsigned char>(acceptLanguage[1])) == 'l' &&
        !isalpha(static_cast<unsigned char>(acceptLanguage[2]))) {
        return Language::pl;
    }
    return Language::en;
}

void writeEscaped(TextSink& sink, const char* text) {
    char chunk[64];
    size_t used = 0;
    for (const char* c = text; *c != '\0'; c++) {
        const char* replacement = nullptr;
        switch (*c) {
            case '&': replacement = "&amp;"; break;
            case '<': replacement = "&lt;"; break;
            case '>': replacement = "&gt;"; break;
            case '"': replacement = "&quot;"; break;
            case '\'': replacement = "&#39;"; break;
        }
        size_t length = replacement ? strlen(replacement) : 1;
        if (used + length >= sizeof(chunk)) {
            chunk[used] = '\0';
            sink.write(chunk);
            used = 0;
        }
        if (replacement) {
            memcpy(chunk + used, replacement, length);
        } else {
            chunk[used] = *c;
        }
        used += length;
    }
    chunk[used] = '\0';
    if (used > 0) sink.write(chunk);
}

void renderSetupPage(const SetupPageModel& model, TextSink& sink) {
    const Texts& texts = textsFor(model.language);
    writeHead(sink, texts);

    sink.write("<p class=\"hint\">");
    sink.write(texts.device);
    sink.write(" ");
    writeEscaped(sink, model.deviceId);
    sink.write(", firmware ");
    writeEscaped(sink, model.firmware);
    sink.write("</p>");

    if (model.recovery) {
        sink.write("<p class=\"note\">");
        sink.write(texts.recovery);
        sink.write("</p>");
    }
    if (model.trialFailure != WifiFailure::none) {
        sink.write("<p class=\"error\">");
        sink.write(texts.trialFailed);
        sink.write(" „");
        writeEscaped(sink, model.trialSsid);
        sink.write("”: ");
        sink.write(failureText(texts, model.trialFailure));
        sink.write(". ");
        sink.write(texts.unchanged);
        sink.write("</p>");
    }
    if (model.error != FormError::none) {
        sink.write("<p class=\"error\">");
        sink.write(texts.errors[static_cast<int>(model.error)]);
        sink.write("</p>");
    }

    sink.write("<h2>");
    sink.write(texts.networks);
    sink.write("</h2><div class=\"nets\">");
    if (model.networkCount == 0) {
        sink.write("<p>");
        sink.write(texts.noNetworks);
        sink.write("</p>");
    }
    for (size_t i = 0; i < model.networkCount; i++) {
        const ScannedNetwork& network = model.networks[i];
        sink.write("<button type=\"button\" data-s=\"");
        writeEscaped(sink, network.ssid);
        sink.write("\" onclick=\"document.getElementById('s').value=this.dataset.s\">");
        writeEscaped(sink, network.ssid);
        char details[24];
        snprintf(details, sizeof(details), " (%d dBm%s)", network.rssi, network.secure ? ", WPA" : "");
        sink.write(details);
        sink.write("</button>");
    }
    sink.write("</div><p><a href=\"/?scan=1\">");
    sink.write(texts.rescan);
    sink.write("</a></p>");

    sink.write("<form method=\"post\" action=\"/save\">");
    writeInput(sink, texts.ssid, "id=\"s\" name=\"ssid\" maxlength=\"32\" required autocapitalize=\"off\"", model.ssid);
    sink.write("<label>");
    sink.write(texts.password);
    sink.write("<input name=\"password\" type=\"password\" maxlength=\"64\" autocomplete=\"off\"></label><p class=\"hint\">");
    sink.write(model.hasPassword ? texts.passwordKeep : texts.passwordNone);
    sink.write("</p><label class=\"check\"><input type=\"checkbox\" name=\"open\" value=\"1\"> ");
    sink.write(texts.openNetwork);
    sink.write("</label>");
    writeInput(sink, texts.name, "name=\"name\" maxlength=\"26\" required", model.name);
    writeInput(sink, texts.hubIp, "name=\"hub\" maxlength=\"63\" autocapitalize=\"off\"", model.hubIp);
    writeHint(sink, texts.hubIpHint);
    writeInput(sink, texts.hubPort, "name=\"port\" type=\"number\" min=\"1\" max=\"65535\"", model.hubPort);
    writeInput(sink, texts.hubId, "name=\"hubid\" maxlength=\"8\" autocapitalize=\"off\"", model.hubId);
    writeHint(sink, texts.hubIdHint);
    sink.write("<label>");
    sink.write(texts.mode);
    sink.write("<select name=\"mode\"><option value=\"wifi\">");
    sink.write(texts.modeWifi);
    sink.write("</option></select></label><button class=\"main\">");
    sink.write(texts.save);
    sink.write("</button></form>");
    if (model.pairedHubId[0] != '\0') {
        sink.write("<p>");
        sink.write(texts.paired);
        sink.write(" <b>");
        writeEscaped(sink, model.pairedHubId);
        sink.write("</b>.</p><form method=\"post\" action=\"/unpair\"><button class=\"main\">");
        sink.write(texts.unpair);
        sink.write("</button></form>");
        writeHint(sink, texts.unpairHint);
    }
    sink.write("<form method=\"post\" action=\"/restart\"><button class=\"main\">");
    sink.write(texts.restart);
    sink.write("</button></form></body></html>");
}

void renderSavedPage(Language language, const char* ssid, TextSink& sink) {
    const Texts& texts = textsFor(language);
    writeHead(sink, texts);
    sink.write("<p>");
    sink.write(texts.saved);
    sink.write(" „");
    writeEscaped(sink, ssid);
    sink.write("”.</p><p>");
    sink.write(texts.savedNext);
    sink.write("</p></body></html>");
}

}  // namespace gctally
