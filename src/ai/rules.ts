import type { Category } from "@/lib/categories";

/**
 * Deterministic merchant rules for UK transactions.
 *
 * This runs before the AI categoriser. Well-known merchants are matched
 * here at zero cost and zero latency, so the model only sees the rows that
 * actually need judgement. It also means the app still categorises most
 * statements when no AI provider is configured or a free tier is rate
 * limited.
 *
 * Order matters: the first matching rule wins, so more specific patterns
 * (Amazon Prime, Uber Eats) sit above broader ones (Amazon, Uber).
 */

export interface RuleMatch {
  category: Category;
  confidence: number;
  reasoning: string;
}

interface Rule {
  category: Category;
  label: string;
  pattern: RegExp;
}

const RULES: Rule[] = [
  // Money moving between the user's own pots and accounts
  {
    category: "Savings and Investments",
    label: "savings or investment platform",
    pattern:
      /\b(savings?|isa|vanguard|moneybox|trading ?212|freetrade|nutmeg|hargreaves|premium bonds|ns&i)\b|\bpot\b/i,
  },
  {
    category: "Council Tax",
    label: "council tax",
    pattern: /council tax|\bctax\b/i,
  },
  {
    category: "Rent and Mortgage",
    label: "rent or mortgage",
    pattern: /\b(rent|lettings?|landlord|mortgage|estate agents?)\b/i,
  },

  // Specific before general
  {
    category: "Subscriptions",
    label: "subscription service",
    pattern:
      /netflix|spotify|disney\s?\+|disney plus|amazon prime|prime video|apple\.com\/bill|icloud|youtube premium|tv licen[cs]e|now tv|audible|puregym|pure gym|the gym group|david lloyd|nuffield health|virgin active|anytime fitness|\bgym\b/i,
  },
  {
    category: "Eating Out",
    label: "restaurant, cafe or takeaway",
    pattern:
      /uber\s?eats|deliveroo|just\s?eat|greggs|pret a manger|\bpret\b|nando|mcdonald|\bkfc\b|burger king|subway|domino|pizza|wagamama|wasabi|itsu|\bleon\b|costa|starbucks|caffe nero|five guys|\bpub\b|wetherspoon|restaurant|\bcafe\b|coffee|\bthe ivy\b|bakery|takeaway/i,
  },
  {
    category: "Groceries",
    label: "supermarket",
    pattern:
      /tesco|sainsbury|\basda\b|\baldi\b|\blidl\b|morrisons|waitrose|co-?op\b|iceland|ocado|m&s food|marks ?& ?spencer food|whole foods/i,
  },
  {
    category: "Transport (Tube and Rail)",
    label: "public transport",
    pattern:
      /\btfl\b|transport for london|trainline|national rail|\blner\b|avanti|northern rail|\bgwr\b|southeastern|thameslink|scotrail|oyster|eurostar|national express|megabus|stagecoach|\barriva\b/i,
  },
  {
    category: "Transport (Car and Fuel)",
    label: "car, fuel or taxi",
    pattern:
      /\bshell\b|\bbp\b|\besso\b|texaco|\bdvla\b|parking|\bncp\b|\bmot\b|kwik fit|halfords|\buber\b|\bbolt\b|free now|petrol|congestion charge/i,
  },
  {
    category: "Utilities (Energy)",
    label: "energy supplier",
    pattern:
      /british gas|octopus energy|\bedf\b|e\.?on\b|\bovo\b|scottish power|bulb energy|shell energy|utilita/i,
  },
  {
    category: "Utilities (Water)",
    label: "water supplier",
    pattern:
      /thames water|severn trent|united utilities|anglian water|yorkshire water|southern water|welsh water|affinity water|south west water/i,
  },
  {
    category: "Internet and Mobile",
    label: "broadband or mobile provider",
    pattern:
      /vodafone|virgin media|\bsky\b|\bo2\b|giffgaff|talktalk|plusnet|hyperoptic|community fibre|\bbt (group|broadband|mobile)\b|^bt$|^ee\b|\bee (limited|ltd|mobile)\b|^three\b|three mobile|\bid mobile\b|voxi|smarty/i,
  },
  {
    category: "Health and Pharmacy",
    label: "pharmacy or healthcare",
    pattern:
      /\bboots\b|superdrug|pharmacy|chemist|nhs|prescription|dentist|dental|optician|specsavers|vision express|bupa/i,
  },
  {
    category: "Entertainment",
    label: "leisure and entertainment",
    pattern:
      /cinema|\bvue\b|odeon|cineworld|picturehouse|everyman|ticketmaster|eventbrite|theatre|bowling|steam games|playstation|xbox|nintendo|museum/i,
  },
  {
    category: "Shopping",
    label: "retailer",
    pattern:
      /amazon|amzn|\bh ?(&|and) ?m\b|waterstones|argos|\basos\b|\bzara\b|primark|john lewis|\bikea\b|currys|\bnext\b|uniqlo|tk ?maxx|\bebay\b|etsy|decathlon|wilko|b&q|\bwhsmith\b/i,
  },
  {
    category: "Transfers",
    label: "transfer",
    pattern: /\btransfer\b|\bpayment to\b|\bfaster payment\b/i,
  },
];

const INCOME_PATTERN =
  /salary|wages|payroll|hmrc|tax refund|refund|universal credit|child benefit|pension|dividend|interest/i;

/**
 * Categorise one transaction from its description and signed amount.
 * Returns null when no rule matches, which leaves the row for the AI.
 */
export function categoriseByRules(
  description: string,
  amount: number
): RuleMatch | null {
  const text = description.trim();

  if (amount > 0) {
    // Money in. Pot and transfer movements are not income.
    const movement = RULES.find(
      (r) =>
        (r.category === "Savings and Investments" ||
          r.category === "Transfers") &&
        r.pattern.test(text)
    );
    if (movement) {
      return {
        category: movement.category,
        confidence: 0.8,
        reasoning: `Money in matched the ${movement.label} rule.`,
      };
    }
    if (INCOME_PATTERN.test(text)) {
      return {
        category: "Income",
        confidence: 0.9,
        reasoning: "Money in matched a salary, refund or benefit keyword.",
      };
    }
    return null;
  }

  const rule = RULES.find((r) => r.pattern.test(text));
  if (!rule) return null;

  return {
    category: rule.category,
    confidence: 0.9,
    reasoning: `Matched the ${rule.label} rule.`,
  };
}
