
import {
    Smartphone,
    Code2,
    KeyRound,
    Database,
    CheckCircle2,
} from "lucide-react";

/**
 * Mobile app + API onboarding.
 *
 * Added to close a measured content gap rather than to raise keyword density.
 * Google Search Console (90d) shows this page already surfacing for an API /
 * mobile-onboarding cluster it barely addresses in copy:
 *
 *   white label telehealth api for custom mobile app onboarding   210 impr, pos 6.5
 *   white label telemedicine platform with api                     17 impr, pos 17.9
 *   telehealth SDK / HIPAA video traffic                            4 impr, pos 8.5
 *   white-label mobile app within three months                      1 impr, pos 4
 *
 * That cluster is served by THIS (global) page and is overwhelmingly European
 * — France, Netherlands, Italy, Germany, Sweden, Belgium — with the US
 * contributing only 7 impressions, so it stays on the global page under the
 * ownership model in docs/seo/white-label-telemedicine-geo-strategy.md.
 *
 * Every claim below is taken from already-published, reviewed copy — the
 * Integration Guide page (/integration-guide) and this page's own FAQ — and
 * keeps their deliberately scoped tone ("confirmed during technical
 * discovery"). Specifics NOT stated in those sources (SDK names, endpoint
 * lists, auth schemes beyond SAML/OIDC, rate limits, app-store distribution,
 * native iOS/Android builds) are intentionally absent: the FAQ states the
 * mobile experience is a native-style PWA, not a native app.
 */
const MobileAppApiSection = () => {
    const apiDomains = [
        "Patient and provider profiles",
        "Appointments and availability",
        "Clinical encounters, notes and attachments",
        "Orders and e-prescriptions, subject to jurisdictional rules",
        "Claims, coverage checks and billing metadata",
        "Audit events and operational logs",
    ];

    const onboardingStages = [
        {
            title: "Discovery",
            outcome: "Scope agreed",
            description:
                "Business requirements, regulatory constraints and success metrics are agreed, along with source-system access, test data and technical contacts.",
        },
        {
            title: "Technical design review",
            outcome: "Architecture confirmed",
            description:
                "Solution architecture is reviewed, including whether a multi-tenant or single-tenant deployment fits your scope.",
        },
        {
            title: "API enablement and environments",
            outcome: "Your team can start building",
            description:
                "Integration guides are issued and environments provisioned so your team can build and test against the platform.",
        },
        {
            title: "Identity and branding configuration",
            outcome: "SSO and branding in place",
            description:
                "Identity/SSO configuration and endpoint whitelisting are completed alongside white-label branding setup.",
        },
        {
            title: "Go-live",
            outcome: "Live and monitored",
            description:
                "Security controls, monitoring and observability are confirmed, then go-live is orchestrated with post-launch optimisation.",
        },
    ];

    return (
        <section
            id="api-onboarding"
            className="scroll-mt-24 py-10 sm:py-16 md:py-24 bg-gray-50"
            aria-labelledby="api-onboarding-heading"
        >
            <div className="container mx-auto px-4">
                <div className="max-w-3xl mb-10 md:mb-12">
                    {/* Spacing lives on wrapper divs, not on the headings and
                        paragraphs themselves: src/styles/original.css ships an unlayered
                        reset that zeroes the margin on h1-h6, p and similar elements,
                        and unlayered rules beat Tailwind v4's layered utilities, so a
                        margin utility placed directly on a heading or paragraph is
                        silently dropped site-wide. */}
                    <div className="mb-4 sm:mb-6">
                        <h2 id="api-onboarding-heading" className="heading-3">
                            Branded Patient App and API Integration
                        </h2>
                    </div>
                    <p className="text-base sm:text-lg text-gray-700 leading-relaxed">
                        You can run your branded virtual care service as a mobile experience for
                        patients and integrate the platform with your own systems through its API.
                        Patients use a native-style Progressive Web App on any smartphone or tablet,
                        while your engineering team works against provisioned environments and
                        integration guides. Available endpoints and integration patterns are
                        confirmed during technical discovery.
                    </p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 md:gap-12">
                    {/* Left column: mobile + identity */}
                    <div className="space-y-6 sm:space-y-8">
                        <div className="flex items-start">
                            <div className="flex-shrink-0 h-5 w-5 sm:h-6 sm:w-6 rounded-full bg-brand-blue/20 flex items-center justify-center mt-1">
                                <Smartphone className="h-3 w-3 sm:h-4 sm:w-4 text-brand-blue" />
                            </div>
                            <div className="ml-3 sm:ml-4">
                                <div className="mb-1">
                                    <h3 className="text-base sm:text-lg font-semibold text-left">
                                        Branded mobile experience
                                    </h3>
                                </div>
                                <p className="text-sm sm:text-base text-gray-600 text-left">
                                    The patient-facing app is a high-performance, native-style
                                    Progressive Web App (PWA) carrying your logo, colours and domain.
                                    It delivers an app-like experience on any smartphone or tablet,
                                    with push notification support and mobile-optimised workflows, and
                                    needs no app-store download.
                                </p>
                            </div>
                        </div>

                        <div className="flex items-start">
                            <div className="flex-shrink-0 h-5 w-5 sm:h-6 sm:w-6 rounded-full bg-brand-blue/20 flex items-center justify-center mt-1">
                                <KeyRound className="h-3 w-3 sm:h-4 sm:w-4 text-brand-blue" />
                            </div>
                            <div className="ml-3 sm:ml-4">
                                <div className="mb-1">
                                    <h3 className="text-base sm:text-lg font-semibold text-left">
                                        Identity, SSO and session handoff
                                    </h3>
                                </div>
                                <p className="text-sm sm:text-base text-gray-600 text-left">
                                    The platform integrates with most enterprise identity providers via
                                    SAML or OIDC. Single sign-on and session handoff are validated
                                    across devices during onboarding, so a patient or clinician moving
                                    between desktop and mobile stays signed in to your branded
                                    environment.
                                </p>
                            </div>
                        </div>

                        <div className="flex items-start">
                            <div className="flex-shrink-0 h-5 w-5 sm:h-6 sm:w-6 rounded-full bg-brand-blue/20 flex items-center justify-center mt-1">
                                <Code2 className="h-3 w-3 sm:h-4 sm:w-4 text-brand-blue" />
                            </div>
                            <div className="ml-3 sm:ml-4">
                                <div className="mb-1">
                                    <h3 className="text-base sm:text-lg font-semibold text-left">
                                        Start focused, expand later
                                    </h3>
                                </div>
                                <p className="text-sm sm:text-base text-gray-600 text-left">
                                    You do not have to integrate everything at once. You can launch with
                                    a focused scope — for example scheduling plus video visits — and add
                                    further features and integrations over time as your service grows.
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Right column: API data domains */}
                    <div className="bg-white border border-gray-100 rounded-xl p-6 md:p-8 shadow-sm">
                        <div className="flex items-center mb-4">
                            <div className="flex-shrink-0 h-6 w-6 rounded-full bg-brand-blue/20 flex items-center justify-center">
                                <Database className="h-4 w-4 text-brand-blue" />
                            </div>
                            <h3 className="ml-3 text-base sm:text-lg font-semibold text-left">
                                What the API covers
                            </h3>
                        </div>
                        <div className="mb-5">
                            <p className="text-sm sm:text-base text-gray-600 text-left">
                                Integration patterns are designed around the data your systems
                                already hold. The domains typically in scope are:
                            </p>
                        </div>
                        <ul className="space-y-2">
                            {apiDomains.map((domain) => (
                                <li key={domain} className="flex items-start text-gray-700">
                                    <CheckCircle2 className="h-5 w-5 text-brand-blue mr-2 flex-shrink-0 mt-0.5" />
                                    <span className="text-sm sm:text-base text-left">{domain}</span>
                                </li>
                            ))}
                        </ul>
                        <div className="mt-5">
                            <p className="text-xs sm:text-sm text-gray-500 text-left">
                                Which domains apply, and the exact integration approach, depend on
                                your existing systems, available APIs and implementation scope.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Onboarding path */}
                <div className="mt-12 md:mt-16">
                    <div className="mb-2">
                        <h3 className="text-lg sm:text-xl font-semibold text-left">
                            How API onboarding works
                        </h3>
                    </div>
                    <div className="mb-6">
                        <p className="text-sm sm:text-base text-gray-600 text-left">
                            Five stages, run with your engineering team. Which integrations are
                            available at each stage depends on your existing systems, available
                            APIs and implementation scope.
                        </p>
                    </div>
                    <ol className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                        {onboardingStages.map((stage, index) => (
                            <li
                                key={stage.title}
                                className="bg-white border border-gray-100 rounded-xl p-5 shadow-sm"
                            >
                                <div className="flex items-center mb-2">
                                    <span className="flex-shrink-0 h-7 w-7 rounded-full bg-brand-blue/20 text-brand-blue text-sm font-semibold flex items-center justify-center">
                                        {index + 1}
                                    </span>
                                    <h4 className="ml-3 text-base font-semibold text-left">
                                        {stage.title}
                                    </h4>
                                </div>
                                <div className="mb-2">
                                    <p className="text-sm font-medium text-brand-blue text-left">
                                        {stage.outcome}
                                    </p>
                                </div>
                                <p className="text-sm text-gray-600 text-left">
                                    {stage.description}
                                </p>
                            </li>
                        ))}
                    </ol>
                </div>
            </div>
        </section>
    );
};

export default MobileAppApiSection;
