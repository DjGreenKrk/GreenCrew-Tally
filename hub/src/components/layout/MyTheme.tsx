import { createTheme, ThemeProvider } from '@mui/material'
import React from 'react';
// import App from 'next/app'

// GreenCrew Tools dark theme (design system sections 4-9): one green accent,
// neutral surfaces. Tally state colours are NOT part of this palette, see
// hub/src/tally/stateColors.ts.
const accent = "#00C853"
const surface = "#121212"
const surfaceVariant = "#1E1E1E"
const border = "#2A2A2A"

const fontFace = (family: string, weight: number, file: string, range: string) => `
@font-face {
  font-family: '${family}';
  font-style: normal;
  font-display: swap;
  font-weight: ${weight};
  src: url('/fonts/${file}') format('woff2');
  unicode-range: ${range};
}`
const latin = "U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD"
const latinExt = "U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF"
const robotoFaces = [400, 500, 700].map(weight =>
  fontFace('Roboto', weight, `roboto-latin-ext-${weight}-normal.woff2`, latinExt) +
  fontFace('Roboto', weight, `roboto-latin-${weight}-normal.woff2`, latin)
).join('\n')

const myTheme = createTheme({
  palette: {
    mode: "dark",
    background: {
      default: "#000000",
      paper: surface,
    },
    primary: {
      main: accent,
      light: "#00E676",
      dark: "#00B248",
      contrastText: "#000000",
    },
    // one accent only: secondary is the same green
    secondary: {
      main: accent,
      light: "#00E676",
      dark: "#00B248",
      contrastText: "#000000",
    },
    text: {
      primary: "#FFFFFF",
      secondary: "#B0B0B0",
      disabled: "#666666",
    },
    divider: border,
    error: { main: "#FF5252" },
    warning: { main: "#FFD54F" },
    info: { main: "#64B5F6" },
    success: { main: accent },
    grey: {
      50: "#FAFAFA",
      100: "#F5F5F5",
      200: "#E0E0E0",
      300: "#BDBDBD",
      400: "#B0B0B0",
      500: "#666666",
      600: "#444444",
      700: "#2A2A2A",
      800: surfaceVariant,
      900: surface,
    }
  },
  shape: { borderRadius: 12 },
  typography: {
    fontSize: 15,
    htmlFontSize: 15,
    fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
    fontWeightLight: 300,
    fontWeightRegular: 400,
    fontWeightMedium: 500,
    fontWeightBold: 700,
    // screen title 24, section 20, card title 16-18, body 14-16, helper 12-14
    h1: { fontSize: "1.5rem", letterSpacing: "0", fontWeight: 500, lineHeight: 1.3 },
    h2: { fontSize: "1.375rem", letterSpacing: "0", fontWeight: 500, lineHeight: 1.3 },
    h3: { fontSize: "1.25rem", letterSpacing: "0", fontWeight: 500, lineHeight: 1.3 },
    h4: { fontSize: "1.25rem", letterSpacing: "0", fontWeight: 500, lineHeight: 1.3 },
    h5: { fontSize: "1.125rem", letterSpacing: "0", fontWeight: 500, lineHeight: 1.35 },
    h6: { fontSize: "1rem", letterSpacing: "0", fontWeight: 500, lineHeight: 1.4 },
    body1: { fontSize: "1rem" },
    body2: { fontSize: "0.875rem" },
    caption: { fontSize: "0.8125rem" },
    button: { textTransform: "none", fontWeight: 500, fontSize: "0.9375rem" },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: robotoFaces,
    },
    MuiAlert: { defaultProps: { variant: "filled" } },
    MuiInput: { defaultProps: { color: "secondary" } },
    MuiInputLabel: { defaultProps: { color: "secondary" } },
    MuiLink: { defaultProps: { color: "primary" } },
    MuiNativeSelect: { defaultProps: { color: "secondary", variant: "filled" } },
    MuiSelect: {
      // native components have better support on mobile
      defaultProps: { native: true, color: "secondary", variant: "filled" },
    },
    MuiTextField: { defaultProps: { color: "secondary", variant: "filled" } },
    MuiFilledInput: {
      styleOverrides: { root: { borderRadius: 8, borderTopLeftRadius: 8, borderTopRightRadius: 8, backgroundColor: surfaceVariant } },
    },
    // buttons without a colour use the text colour (neutral); the green accent
    // is reserved for the main action (color="primary")
    MuiButton: {
      defaultProps: { color: "inherit" },
      styleOverrides: { root: { borderRadius: 10, minHeight: 44 } },
    },
    // touch targets of at least 44x44 px (design system section 19)
    MuiIconButton: { styleOverrides: { root: { minWidth: 44, minHeight: 44 } } },
    MuiChip: { styleOverrides: { root: { borderRadius: 8 } } },
    MuiPaper: { styleOverrides: { root: { backgroundImage: "none" } } },
    MuiDialog: { styleOverrides: { paper: { borderRadius: 16 } } },
    MuiAppBar: {
      defaultProps: { enableColorOnDark: true, color: "default", elevation: 0 },
      styleOverrides: {
        root: { backgroundColor: surface, backgroundImage: "none", color: "#FFFFFF", borderBottom: `1px solid ${border}` },
      },
    },
  },

})

type MyThemeProps = {
  children: React.ReactNode
}

function MyTheme({children}: MyThemeProps) {
  return <ThemeProvider theme={myTheme}>{children}</ThemeProvider>
}

export default MyTheme