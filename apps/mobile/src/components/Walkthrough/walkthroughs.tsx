import React from 'react';
import { Linking, View } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { COMMUNITY_SVG, LAUNCH_ROCKET, SUPPORT_SVG, WELCOME_SVG } from '../../assets/images/assets';
import { TrackedState, useTracked } from '../../provider';
import { eSendEvent } from '../../services/EventManager';
import { getElevation } from '../../utils';
import { eOpenAddNotebookDialog } from '../../utils/Events';
import { SIZE } from '../../utils/SizeUtils';
import useRotator from '../../utils/use-rotator';
import { AccentColorPicker } from '../../views/Settings/appearance';
import { Button } from '../Button';
import { SvgToPngView } from '../ListPlaceholders';
import { PinItem } from '../Menu/TagsSection';
import Seperator from '../Seperator';
import Heading from '../Typography/Heading';
import Paragraph from '../Typography/Paragraph';

export type TStep = {
  text?: string;
  walkthroughItem: (colors: TrackedState['colors']) => React.ReactNode;
  title?: string;
  button?: {
    type: 'next' | 'done';
    title: string;
    action?: () => void;
  };
  actionButton?: {
    text: string;
    action: () => void;
  };
};

const NotebookWelcome = () => {
  const [state] = useTracked();
  const { colors } = state;
  const data = useRotator([
    {
      title: 'Work and office',
      description: 'Everything related to my job',
      count: 2
    },
    {
      title: 'School work',
      description: "I don't like doing this but I have to.",
      count: 5
    },
    {
      title: 'Recipies',
      description: 'I love cooking and collecting recipies',
      count: 10
    }
  ]);

  return (
    <View
      style={{
        width: '100%',
        padding: 12,
        backgroundColor: colors.nav,
        borderRadius: 10
      }}
    >
      <View
        style={{
          padding: 12,
          width: '100%',
          backgroundColor: colors.bg,
          ...getElevation(3),
          borderRadius: 10,
          marginVertical: 12
        }}
      >
        <Heading size={SIZE.md} color={colors.heading}>
          {data?.title}
        </Heading>
        <Paragraph>{data?.description}</Paragraph>

        <Paragraph
          style={{
            marginTop: 5
          }}
          size={SIZE.xs}
          color={colors.icon}
        >
          Notebook - {data?.count} notes
        </Paragraph>
      </View>
    </View>
  );
};

const notebooks: { id: string; steps: TStep[] } = {
  id: 'notebooks',
  steps: [
    {
      title: 'Notebooks',
      text: 'Boost your productivity with Notebooks and organize your notes.',
      walkthroughItem: () => <NotebookWelcome />,
      button: {
        type: 'next',
        title: 'Next'
      }
    },
    {
      title: 'Notebook > Topic > Notes',
      text: 'Every Notebook has various topics which are like sections that hold all your notes.',
      walkthroughItem: (colors: TrackedState['colors']) => (
        <View
          style={{
            width: '100%',
            padding: 12,
            backgroundColor: colors.nav,
            borderRadius: 10
          }}
        >
          <View
            style={{
              padding: 12,
              width: '100%',
              backgroundColor: colors.bg,
              ...getElevation(3),
              borderRadius: 10,
              marginVertical: 12
            }}
          >
            <Heading size={SIZE.md} color={colors.heading}>
              Work and office
            </Heading>
            <Paragraph>Everything related to my job in one place.</Paragraph>

            <Paragraph
              style={{
                marginTop: 5
              }}
              size={SIZE.xs}
              color={colors.icon}
            >
              Notebook - 2 notes
            </Paragraph>
          </View>
          <View
            style={{
              padding: 12,
              width: '90%',
              backgroundColor: colors.bg,
              borderRadius: 10,
              alignSelf: 'flex-end',
              marginBottom: 10
            }}
          >
            <Paragraph color={colors.accent}>
              <Icon color={colors.accent} size={SIZE.sm} name="bookmark" /> Tasks
            </Paragraph>
          </View>
          <View
            style={{
              padding: 12,
              paddingVertical: 12,
              width: '80%',
              backgroundColor: colors.bg,
              borderRadius: 5,
              alignSelf: 'flex-end',
              marginBottom: 10
            }}
          >
            <Paragraph size={SIZE.xs}>
              <Icon color={colors.icon} size={SIZE.sm} name="note" /> Feburary 2022 Week 2
            </Paragraph>
          </View>
          <View
            style={{
              padding: 12,
              width: '80%',
              backgroundColor: colors.bg,
              borderRadius: 5,
              paddingVertical: 12,
              alignSelf: 'flex-end',
              marginBottom: 10
            }}
          >
            <Paragraph size={SIZE.xs}>
              <Icon color={colors.icon} size={SIZE.sm} name="note" /> Feburary 2022 Week 1
            </Paragraph>
          </View>
          <View
            style={{
              padding: 12,
              width: '90%',
              backgroundColor: colors.bg,
              borderRadius: 10,
              alignSelf: 'flex-end',
              marginBottom: 10
            }}
          >
            <Paragraph color={colors.accent}>
              <Icon color={colors.accent} size={SIZE.sm} name="bookmark" /> Meetings
            </Paragraph>
          </View>
        </View>
      ),
      button: {
        type: 'next',
        title: 'Next'
      }
    },
    {
      title: 'Easy access',
      text: 'You can create shortcuts of frequently accessed notebooks or topics in Side Menu',
      walkthroughItem: () => (
        <View
          style={{
            paddingHorizontal: 20,
            paddingVertical: 12
          }}
        >
          <PinItem
            index={0}
            placeholder={true}
            item={{
              title: 'Tasks',
              type: 'topic'
            }}
            onPress={() => {}}
          />

          <PinItem
            index={1}
            placeholder={true}
            item={{
              title: 'Work and office',
              type: 'notebook'
            }}
            onPress={() => {}}
          />
        </View>
      ),
      button: {
        type: 'done',
        title: 'Add your first notebook',
        action: () => {
          eSendEvent(eOpenAddNotebookDialog);
        }
      }
    }
  ]
};

const ChooseTheme = () => {
  const [state] = useTracked();
  const { colors } = state;

  return (
    <View
      style={{
        maxHeight: 170,
        alignItems: 'center',
        marginTop: 20
      }}
    >
      <Heading>Make yourself at home</Heading>

      <Paragraph
        style={{
          textAlign: 'center',
          alignSelf: 'center',
          maxWidth: '80%'
        }}
        size={SIZE.md}
      >
        Pick a theme of your choice
      </Paragraph>
      <Seperator />
      <AccentColorPicker settings={false} />
      <Seperator />
    </View>
  );
};

const trialstarted: { id: string; steps: TStep[] } = {
  id: 'trialstarted',
  steps: [
    {
      title: 'Your trial is activated',
      text: 'You can use all permium features for free for the next 14 days',
      walkthroughItem: colors => <SvgToPngView src={LAUNCH_ROCKET(colors.pri)} />,
      button: {
        type: 'next',
        title: 'Next'
      }
    },

    {
      // title: 'Make yourself at home',
      // text: 'Pick a theme of your choice',
      walkthroughItem: () => <ChooseTheme />,
      button: {
        type: 'next',
        title: 'Next'
      }
    },
    {
      title: 'Join the cause',
      text: 'Meet other privacy-minded people and talk to us directly about your concerns, issues and suggestions.',
      walkthroughItem: colors => <SvgToPngView src={COMMUNITY_SVG(colors.pri)} />,
      button: {
        type: 'done',
        title: 'Continue'
      },
      actionButton: {
        text: 'Join Discord Community',
        action: () => {
          Linking.openURL('https://discord.gg/zQBK97EE22').catch(console.log);
        }
      }
    }
  ]
};

const emailconfirmed: { id: string; steps: TStep[] } = {
  id: 'emailconfirmed',
  steps: [
    {
      title: 'Email confirmed',
      text: 'Your email was confirmed successfully. Thank you for choosing end-to-end encrypted note taking.',
      walkthroughItem: colors => <SvgToPngView src={WELCOME_SVG(colors.pri)} />,
      button: {
        type: 'done',
        title: 'Continue'
      }
    }
  ]
};

const Support = () => {
  const [state] = useTracked();
  const { colors } = state;

  return (
    <View
      style={{
        width: '100%',
        alignItems: 'center'
      }}
    >
      <SvgToPngView src={SUPPORT_SVG()} />
      <Heading>Get Priority Support</Heading>
      <Paragraph
        style={{
          textAlign: 'center'
        }}
        size={SIZE.md}
      >
        You can reach out to us via multiple channels if you face an issue or want to just talk.
      </Paragraph>
      <Seperator />

      <Button
        style={{
          justifyContent: 'flex-start',
          marginBottom: 10,
          width: '90%'
        }}
        onPress={() => {
          Linking.openURL('https://discord.gg/zQBK97EE22').catch(console.log);
        }}
        icon="discord"
        type="grayBg"
        title="Join our community on Discord"
      />

      <Button
        style={{
          justifyContent: 'flex-start',
          marginBottom: 10,
          width: '90%'
        }}
        onPress={() => {
          Linking.openURL('https://t.me/notesnook').catch(console.log);
        }}
        icon="telegram"
        type="grayBg"
        title="Join our Telegram group"
      />
      <Button
        style={{
          justifyContent: 'flex-start',
          marginBottom: 10,
          width: '90%'
        }}
        icon="bug"
        type="grayBg"
        title="Submit an issue from Settings"
      />
      <Button
        style={{
          justifyContent: 'flex-start',
          marginBottom: 10,
          width: '90%'
        }}
        icon="mail"
        type="grayBg"
        title="Email us at support@streetwriters.co"
      />
    </View>
  );
};

const prouser: { id: string; steps: TStep[] } = {
  id: 'prouser',
  steps: [
    {
      title: 'Welcome to Notesnook Pro',
      text: 'Thank you for reaffirming our idea that privacy comes first',
      walkthroughItem: colors => <SvgToPngView src={LAUNCH_ROCKET(colors.pri)} />,
      button: {
        type: 'next',
        title: 'Next'
      }
    },
    {
      walkthroughItem: () => <Support />,
      button: {
        type: 'done',
        title: 'Continue'
      }
    }
  ]
};

export default { notebooks, trialstarted, emailconfirmed, prouser };
