
import {
    Paintbrush,
    Link as LinkIcon,
    CalendarCheck,
    Video,
    Smartphone,
} from "lucide-react";

/**
 * "What's included in your branded telehealth platform".
 *
 * Sits directly below the hero so the five capabilities buyers search for are
 * visible before any scrolling: branded patient portal, custom domain,
 * appointment booking, video consultations and mobile access.
 *
 * This section CONSOLIDATES the former BrandTrustSection ("Build Patient Trust
 * with Your Branded Telemedicine Solution"), whose three cards — brand
 * customization, custom domain integration, branded patient experience — are
 * carried over here verbatim in substance. BrandTrustSection is no longer
 * rendered on this page; removing it also clears a long-standing duplicate H2,
 * since PatientTrustSection further down carries the near-identical heading
 * "Build Patient Trust with Your Brand".
 *
 * Every claim below already appears in reviewed copy elsewhere on this page or
 * site — BrandTrustSection, the Multi-Platform Access feature block, the
 * branded-patient-app section and the launch guide's configuration step. The
 * patient app is described as a Progressive Web App, matching the FAQ and the
 * branded-patient-app section; no native iOS/Android build is claimed. Nothing
 * here asserts pricing, a launch timeline, a certification or an integration
 * that is not already scoped as "confirmed during discovery".
 *
 * The portal card carries id="patient-portal" so it can be linked directly:
 * /solutions/white-label-telemedicine/#patient-portal
 */
const WhatsIncludedSection = () => {
    const capabilities = [
        {
            id: "patient-portal",
            icon: Paintbrush,
            title: "Branded patient portal",
            description:
                "A patient portal carrying your logo, colours and typography across every patient-facing and provider-facing screen, so patients stay in your brand from first visit to follow-up.",
        },
        {
            id: "custom-domain",
            icon: LinkIcon,
            title: "Your own domain",
            description:
                "The platform runs on your domain or subdomain, so patients reach virtual care at your URL rather than a vendor's, in line with your existing web presence.",
        },
        {
            id: "appointment-booking",
            icon: CalendarCheck,
            title: "Appointment booking",
            description:
                "Patients book consultations themselves, with consultation lengths, specialties and provider availability configured to match how your practice already works.",
        },
        {
            id: "video-consultations",
            icon: Video,
            title: "Video consultations",
            description:
                "Patients join video visits from the browser, with booking confirmations, reminders and post-visit follow-up messages sent under your brand.",
        },
        {
            id: "mobile-access",
            icon: Smartphone,
            title: "Mobile access",
            description:
                "The patient experience is a native-style Progressive Web App that works on any smartphone or tablet, with push notification support and no app-store download.",
        },
    ];

    return (
        <section
            className="py-16 bg-white"
            aria-labelledby="whats-included-heading"
        >
            <div className="container mx-auto px-4">
                {/* Spacing lives on wrapper divs, not on the headings and paragraphs
                    themselves: src/styles/original.css ships an unlayered reset that
                    zeroes the margin on h1-h6, p and similar elements, and unlayered
                    rules beat Tailwind v4's layered utilities, so a margin utility
                    placed directly on a heading or paragraph is silently dropped
                    site-wide. */}
                <div className="text-center max-w-3xl mx-auto mb-12 md:mb-16">
                    <div className="mb-4 sm:mb-6">
                        <h2 id="whats-included-heading" className="heading-3">
                            What&apos;s included in your branded telehealth platform
                        </h2>
                    </div>
                    <p className="text-base sm:text-lg text-gray-700">
                        Everything patients and clinicians touch carries your brand, on your
                        domain. The capabilities below are part of the platform; which
                        integrations and configuration options apply to your deployment is
                        confirmed during technical discovery.
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
                    {capabilities.map(({ id, icon: Icon, title, description }) => (
                        <div
                            key={id}
                            id={id}
                            className="scroll-mt-24 bg-white p-8 rounded-xl shadow-md hover:shadow-lg transition-shadow"
                        >
                            <div className="h-14 w-14 bg-brand-blue/20 rounded-full flex items-center justify-center mb-6 mx-auto">
                                <Icon className="h-8 w-8 text-brand-blue" />
                            </div>
                            <div className="mb-4">
                                <h3 className="text-xl font-semibold text-center">{title}</h3>
                            </div>
                            <p className="text-gray-600">{description}</p>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
};

export default WhatsIncludedSection;
