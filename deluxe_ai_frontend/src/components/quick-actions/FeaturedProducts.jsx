import { title } from "framer-motion/client";
import {
  Package,
  FileText,
  Sparkles,
  Scale,
  PhoneCallIcon,
  MessageCircleMore,
} from "lucide-react";

export const FEATURED_PRODUCTS = [
  {
    id: "business-cards",
    name: "Business Cards",
    description: "Professional business cards for networking and branding.",
    price: "Starting from AED 60",
    image: "https://www.dlxprint.com/images/print&marketing/3d_foil_business_cards_dubai.webp",
    badge: "Best Seller",
    prompt: "I want to order business cards",
  },

  {
    id: "self-ink-stamps",
    name: "Self Ink Stamps",
    description: "High quality custom office stamps with long-lasting ink.",
    price: "Starting from AED 90",
    image: "https://www.dlxprint.com/images/print&marketing/self_ink_stamps_dubai.webp",
    badge: "Popular",
    prompt: "I want to order self ink stamps",
  },

  {
    id: "popup-display",
    name: "Pop Up Display Stand",
    description: "Premium exhibition displays for events and trade shows.",
    price: "Starting from AED 799",
    image: "https://www.dlxprint.com/images/backdrops&exhibition/softcase_curved_popup_banner_printing_dubai.webp",
    badge: "Premium",
    prompt: "I want to order Pop Up Display Stands",
  },
];

export const QUICK_ACTIONS = [
  {
    icon: FileText,
    title: "Request Quotation",
    description: "Get a quotation",
    prompt: "Request quotation",
  },
  {
    icon: PhoneCallIcon,
    title: "talk to expert",
    description: "Talk to expert",
    prompt: "i want to connect with expert",
  },
  {
    icon: MessageCircleMore,
    title: "Chat with Expert",
    description: "Connect with an expert through WhatsApp",
    link: "https://api.whatsapp.com/send?phone=97142725202&text=Hi%20Deluxe%20Printing,%20I'm%20interested%20in%20your%20printing%20services.%20Could%20you%20please%20assist%20me?",
  },
];
