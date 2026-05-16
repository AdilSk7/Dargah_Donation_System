import i18n from "i18next";
import { initReactI18next } from "react-i18next";

i18n.use(initReactI18next).init({
  resources: {
    en: {
      translation: {
        title: "Dargah Donation",
        monthlyContribution: "Monthly Contribution — ₹100/month",
        login: "Login",
        register: "Register",
        mobile: "Mobile Number",
        password: "Password"
      }
    },

    te: {
      translation: {
        title: "దర్గా విరాళం",
        monthlyContribution: "నెలవారీ విరాళం — ₹100/నెల",
        login: "లాగిన్",
        register: "నమోదు",
        mobile: "మొబైల్ నంబర్",
        password: "పాస్‌వర్డ్"
      }
    }
  },

  lng: "en",
  fallbackLng: "en",
  interpolation: {
    escapeValue: false
  }
});

export default i18n;